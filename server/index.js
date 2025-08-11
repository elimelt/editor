const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const helmet = require('helmet');
require('dotenv').config();
const {
  logger,
  requestIdMiddleware,
  requestLoggingMiddleware,
  serializeError,
} = require('./logger');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cookieParser());
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware);

const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.GH_CLIENT_ID;
const CLIENT_SECRET = process.env.GH_CLIENT_SECRET;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:8080';
const REDIRECT_URI = process.env.GH_REDIRECT_URI || `${FRONTEND_ORIGIN}/api/auth/callback`;
const OAUTH_SCOPES = (process.env.GH_OAUTH_SCOPES || 'read:user user:email public_repo')
  .replace(/[,\s]+/g, ' ')
  .trim();

if (!CLIENT_ID || !CLIENT_SECRET) {
  logger.warn('config_missing_github_oauth_secrets', {
    clientIdPresent: Boolean(CLIENT_ID),
    clientSecretPresent: Boolean(CLIENT_SECRET),
  });
}

logger.info('server_config', {
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  trustProxy: true,
  port: PORT,
  frontendOrigin: FRONTEND_ORIGIN,
  redirectUri: REDIRECT_URI,
  oauthScopesCount: OAUTH_SCOPES.split(' ').filter(Boolean).length,
  clientIdPresent: Boolean(CLIENT_ID),
  clientSecretPresent: Boolean(CLIENT_SECRET),
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const isSecure = (req.protocol === 'https') || (req.headers['x-forwarded-proto'] === 'https');
  res.cookie('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/',
  });
  // Preserve return_to query (e.g., ?owner=...&repo=...&path=...) if provided
  const returnTo = typeof req.query.return_to === 'string' ? req.query.return_to : '';
  if (returnTo && returnTo.length <= 1024) {
    res.cookie('oauth_return_to', returnTo, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
      maxAge: 10 * 60 * 1000,
      path: '/',
    });
  }
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authorizeUrl.searchParams.set('scope', OAUTH_SCOPES);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('allow_signup', 'true');
  logger.info('oauth_login_redirect', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    isSecure,
    scopesCount: OAUTH_SCOPES.split(' ').filter(Boolean).length,
  });
  res.redirect(authorizeUrl.toString());
});

app.get('/api/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const stateCookie = req.cookies.oauth_state;
    logger.info('oauth_callback_received', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasStateCookie: Boolean(stateCookie),
    });
    if (!code || !state || !stateCookie || stateCookie !== state) {
      logger.warn('oauth_state_invalid', {
        requestId: req.id,
        reason: 'Invalid OAuth state or missing code',
      });
      return res.status(400).send('Invalid OAuth state or missing code');
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });


    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      logger.warn('oauth_token_exchange_failed', {
        requestId: req.id,
        status: tokenRes.status,
        bodyPreview: String(text).slice(0, 200),
      });
      return res.status(502).send('Token exchange failed');
    }
    let tokenJson;
    const ct = tokenRes.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      tokenJson = await tokenRes.json();
    } else {
      const raw = await tokenRes.text();
      try {
        tokenJson = Object.fromEntries(new URLSearchParams(raw));
      } catch {
        tokenJson = { raw };
      }
    }
    if (!tokenJson.access_token) {
      logger.error('oauth_no_access_token', {
        requestId: req.id,
        payload: tokenJson,
      });
      return res.status(502).send('No access token returned');
    }

    res.clearCookie('oauth_state', { path: '/' });

    // Restore return_to query string if present
    const returnToCookie = req.cookies.oauth_return_to;
    if (returnToCookie) {
      res.clearCookie('oauth_return_to', { path: '/' });
    }

    const redirectUrl = new URL(FRONTEND_ORIGIN);
    const hashParts = [`access_token=${encodeURIComponent(tokenJson.access_token)}`];
    if (returnToCookie && typeof returnToCookie === 'string') {
      // Ensure it starts with '?' and is a safe subset
      const qs = returnToCookie.startsWith('?') ? returnToCookie : `?${returnToCookie}`;
      redirectUrl.search = qs;
    }
    redirectUrl.hash = hashParts.join('&');
    logger.info('oauth_success_redirect', {
      requestId: req.id,
      redirectHost: redirectUrl.host,
    });
    return res.redirect(redirectUrl.toString());
  } catch (err) {
    logger.error('oauth_callback_error', {
      requestId: req.id,
      error: serializeError(err),
    });
    return res.status(500).send('OAuth callback error');
  }
});

app.use((err, req, res, next) => {
  logger.error('http_request_error', {
    requestId: req?.id,
    method: req?.method,
    path: req?.path,
    error: serializeError(err),
  });
  res.status(500).send('Internal Server Error');
});

app.listen(PORT, () => {
  logger.info('server_listening', { port: PORT });
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', { error: serializeError(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('uncaught_exception', { error: serializeError(err) });
  process.exit(1);
});


