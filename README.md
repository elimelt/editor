Modern GitHub Text Editor (minimal auth server)

This project is a minimal SPA frontend with a tiny server used strictly for GitHub OAuth. The SPA talks directly to the GitHub REST API to read and update file contents via commits.

What's included
- Frontend: plain HTML + vanilla JS, no styling. Login, open a file, edit, save (commit).
- Server: Node + Express. Only handles OAuth: login redirect and callback code→token exchange.
- Docker: Nginx serves the static site and reverse-proxies /api to the auth server.

Architecture
- Frontend (static): served by Nginx
- Auth server: GET /api/auth/login and GET /api/auth/callback only
- Browser stores the access token in sessionStorage; all GitHub API calls happen directly from the client.

Security note
For prototyping, we return the access token to the SPA via URL hash. For production hardening, migrate to PKCE or short-lived server tokens. The auth server remains strictly auth-only.

Logging
- Structured JSON logs with request IDs. Each log line is a single JSON object written to stdout.
- Log levels: trace, debug, info, warn, error (default: info). Configure with `LOG_LEVEL`.
- Sensitive fields are redacted automatically (e.g., authorization, cookie, token, client_secret).
- Common events:
  - `server_config`, `server_listening`
  - `request_completed` (includes statusCode and durationMs)
  - `oauth_login_redirect`, `oauth_callback_received`
  - `oauth_token_exchange_failed`, `oauth_no_access_token`, `oauth_success_redirect`
  - `unhandled_rejection`, `uncaught_exception`

Prerequisites
- Docker and Docker Compose
- A GitHub OAuth App (Client ID/Secret)

Create a GitHub OAuth App
1) In your GitHub account: Settings → Developer settings → OAuth Apps → New OAuth App
2) Set:
   - Application name: your choice
   - Homepage URL: http://localhost:8080
   - Authorization callback URL: http://localhost:8080/api/auth/callback
3) After creating, copy the Client ID and Client Secret
4) Scopes: start with public_repo, read:user, user:email. Use repo if you need private repos.

Configure environment
1) Create a `server/.env` file with:

   PORT=3000
   GH_CLIENT_ID=your_client_id
   GH_CLIENT_SECRET=your_client_secret
   FRONTEND_ORIGIN=http://localhost:8080
   GH_REDIRECT_URI=http://localhost:8080/api/auth/callback
   GH_OAUTH_SCOPES=read:user user:email public_repo
   # Optional logging level: trace | debug | info | warn | error
   LOG_LEVEL=info

Run locally with Docker (both services together)
1) Build and start:
   docker compose up --build -d
2) Open http://localhost:8080
3) Click “Login with GitHub”, approve the OAuth prompt
4) You should see your GitHub username and can open/save files

Local (without Docker)
- Terminal 1 (auth server):
  cd server && npm install && npm start
- Terminal 2 (static server):
  npx http-server ./frontend -p 8080 -c-1
  Visit http://localhost:8080

Deploying
- Host frontend on GitHub Pages, backend on your server:
  - Frontend: this repo’s GitHub Pages is published by the GitHub Action. It injects `frontend/config.js` at build time using `AUTH_SERVER_BASE_URL` secret.
  - Backend: a separate compose file `docker-compose.server.yml` runs only the auth server.
  - On your server, create/update the GitHub OAuth App to:
    - Homepage URL: your Pages URL (e.g., https://<username>.github.io/<repo>/)
    - Authorization callback URL: https://<your-auth-server-domain>/api/auth/callback
  - Set server env:
    - `FRONTEND_ORIGIN=https://<username>.github.io/<repo>/`
    - `GH_REDIRECT_URI=https://<your-auth-server-domain>/api/auth/callback`
    - `LOG_LEVEL=info` (recommended)
  - Start server-only stack on your VM:
    docker compose -f docker-compose.server.yml up -d --build

GitHub Actions
- `.github/workflows/deploy-frontend.yml`: publishes `frontend/` to GitHub Pages.
  - Requires repo secrets: `AUTH_SERVER_BASE_URL` (e.g., https://auth.example.com/api)
- `.github/workflows/deploy-backend.yml`: deploys the auth server to your VM via SSH.
  - Requires repo secrets: `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY` (private key), `SERVER_WORKDIR` (remote path), `GH_CLIENT_ID`, `GH_CLIENT_SECRET`, `FRONTEND_ORIGIN`, `GH_REDIRECT_URI`, `GH_OAUTH_SCOPES`.

Usage (basic)
1) Login with GitHub
2) Enter owner, repo, branch, and file path
3) Open file → edit in the textarea
4) Enter a commit message → Save (creates a commit on the branch)

Troubleshooting
- 403/404 on save: ensure scopes (use repo for private repos), and you have push access to the repo/branch
- 409 conflict: the file changed upstream; re-open to refresh sha then save
- Callback mismatch: double-check GH_REDIRECT_URI matches your OAuth App callback URL exactly


