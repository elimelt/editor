/* Minimal GitHub OAuth server: strictly for auth */

const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cookieParser());

const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.GH_CLIENT_ID;
const CLIENT_SECRET = process.env.GH_CLIENT_SECRET;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:8080';
const REDIRECT_URI = process.env.GH_REDIRECT_URI || `${FRONTEND_ORIGIN}/api/auth/callback`;
const OAUTH_SCOPES = (process.env.GH_OAUTH_SCOPES || 'read:user user:email public_repo')
  .replace(/[,\s]+/g, ' ')
  .trim();

if (!CLIENT_ID || !CLIENT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn('Warning: GH_CLIENT_ID or GH_CLIENT_SECRET not set');
}

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
  res.redirect(authorizeUrl.toString());
});

app.get('/api/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const stateCookie = req.cookies.oauth_state;
    if (!code || !state || !stateCookie || stateCookie !== state) {
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
      return res.status(502).send(`Token exchange failed: ${text}`);
    }
    const tokenJson = await tokenRes.json();
    if (!tokenJson.access_token) {
      return res.status(502).send('No access token returned');
    }

    // Clear state cookie
    res.clearCookie('oauth_state', { path: '/' });

    // Hand off token to SPA via URL hash (one-time)
    const redirectUrl = new URL(FRONTEND_ORIGIN);
    redirectUrl.hash = `access_token=${encodeURIComponent(tokenJson.access_token)}`;
    return res.redirect(redirectUrl.toString());
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).send('OAuth callback error');
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Auth server listening on port ${PORT}`);
});


