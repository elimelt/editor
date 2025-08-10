(function () {
  const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '/api';

  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userInfo = document.getElementById('user-info');
  const statusEl = document.getElementById('status');

  const ownerEl = document.getElementById('owner');
  const repoEl = document.getElementById('repo');
  const branchEl = document.getElementById('branch');
  const pathEl = document.getElementById('path');
  const openBtn = document.getElementById('open-btn');

  const editorSection = document.getElementById('editor');
  const contentEl = document.getElementById('file-content');
  const commitMsgEl = document.getElementById('commit-message');
  const saveBtn = document.getElementById('save-btn');

  let accessToken = null;
  let currentSha = null; // sha of opened file, required for update

  function setStatus(message, isError) {
    statusEl.textContent = message || '';
    statusEl.style.color = isError ? 'red' : 'black';
  }

  function storeToken(token) {
    accessToken = token;
    sessionStorage.setItem('gh_access_token', token);
  }

  function loadToken() {
    const hash = window.location.hash || '';
    const match = hash.match(/access_token=([^&]+)/);
    if (match) {
      // One-time capture from URL hash, then clean it
      const token = decodeURIComponent(match[1]);
      storeToken(token);
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } else {
      const fromSession = sessionStorage.getItem('gh_access_token');
      if (fromSession) accessToken = fromSession;
    }
  }

  async function fetchGitHub(path, options = {}) {
    if (!accessToken) throw new Error('Missing access token');
    const headers = Object.assign({}, options.headers || {}, {
      Authorization: `token ${accessToken}`,
      Accept: 'application/vnd.github+json',
    });
    const res = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  }

  function toBase64Unicode(str) {
    // Encode Unicode safely
    return btoa(unescape(encodeURIComponent(str)));
  }

  function fromBase64Unicode(b64) {
    return decodeURIComponent(escape(atob(b64)));
  }

  async function renderUser() {
    if (!accessToken) {
      userInfo.textContent = 'Not logged in';
      loginBtn.style.display = 'inline-block';
      logoutBtn.style.display = 'none';
      return;
    }
    try {
      const me = await fetchGitHub('/user');
      userInfo.textContent = `Logged in as ${me.login}`;
      loginBtn.style.display = 'none';
      logoutBtn.style.display = 'inline-block';
    } catch (err) {
      console.error(err);
      userInfo.textContent = 'Login error. Please login again.';
      loginBtn.style.display = 'inline-block';
      logoutBtn.style.display = 'none';
    }
  }

  async function openFile() {
    setStatus('Opening file...');
    currentSha = null;
    const owner = ownerEl.value.trim();
    const repo = repoEl.value.trim();
    const branch = branchEl.value.trim() || 'main';
    const path = pathEl.value.trim();
    if (!owner || !repo || !path) {
      setStatus('Owner, repo, and path are required', true);
      return;
    }
    try {
      const data = await fetchGitHub(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`);
      if (!data || !data.content) throw new Error('No content returned');
      currentSha = data.sha;
      const text = fromBase64Unicode(data.content.replace(/\n/g, ''));
      contentEl.value = text;
      editorSection.style.display = 'block';
      setStatus(`Opened ${owner}/${repo}@${branch}:${path}`);
    } catch (err) {
      console.error(err);
      setStatus(`Open failed: ${err.message}`, true);
    }
  }

  async function saveFile() {
    setStatus('Saving...');
    const owner = ownerEl.value.trim();
    const repo = repoEl.value.trim();
    const branch = branchEl.value.trim() || 'main';
    const path = pathEl.value.trim();
    const message = commitMsgEl.value.trim() || `Update ${path}`;
    const contentText = contentEl.value;
    if (!owner || !repo || !path) {
      setStatus('Owner, repo, and path are required', true);
      return;
    }
    if (!currentSha) {
      setStatus('Missing file sha; please open the file again.', true);
      return;
    }
    try {
      const body = {
        message,
        content: toBase64Unicode(contentText),
        branch,
        sha: currentSha,
      };
      const data = await fetchGitHub(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      currentSha = data.content && data.content.sha ? data.content.sha : null;
      setStatus('Saved successfully.');
    } catch (err) {
      console.error(err);
      setStatus(`Save failed: ${err.message}`, true);
    }
  }

  function login() {
    window.location.href = `${API_BASE}/auth/login`;
  }

  function logout() {
    accessToken = null;
    sessionStorage.removeItem('gh_access_token');
    editorSection.style.display = 'none';
    contentEl.value = '';
    commitMsgEl.value = '';
    userInfo.textContent = 'Logged out';
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
  }

  // Wire up events
  loginBtn.addEventListener('click', login);
  logoutBtn.addEventListener('click', logout);
  openBtn.addEventListener('click', openFile);
  saveBtn.addEventListener('click', saveFile);

  // Init
  loadToken();
  renderUser();
})();


