/* Minimal GitHub OAuth server: strictly for auth */

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

    // Exchange code → token
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

    // Clear state cookie
    res.clearCookie('oauth_state', { path: '/' });

    // Hand off token to SPA via URL hash (one-time)
    const redirectUrl = new URL(FRONTEND_ORIGIN);
    redirectUrl.hash = `access_token=${encodeURIComponent(tokenJson.access_token)}`;
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

// Express error handler (fallback)
// eslint-disable-next-line no-unused-vars
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

// Global handlers
process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', { error: serializeError(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('uncaught_exception', { error: serializeError(err) });
  // Allow container/orchestrator to restart the process
  process.exit(1);
});


