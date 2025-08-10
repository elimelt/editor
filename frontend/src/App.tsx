import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getMe,
  readAccessTokenFromHashOrSession,
  loginRedirect,
  getFile,
  putFile,
  toBase64Unicode,
  fromBase64Unicode,
  clearToken,
  HttpError,
} from '@/api/github';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

export function App(): JSX.Element {
  const [tokenPresent, setTokenPresent] = useState<boolean>(false);
  const [user, setUser] = useState<{ login: string } | null>(null);
  const [userState, setUserState] = useState<LoadState>('idle');

  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [path, setPath] = useState('');

  const [content, setContent] = useState('');
  const [sha, setSha] = useState<string | null>(null);
  const [commitMsg, setCommitMsg] = useState('');
  const [openState, setOpenState] = useState<LoadState>('idle');
  const [saveState, setSaveState] = useState<LoadState>('idle');
  const [status, setStatus] = useState<string>('');
  const [statusKind, setStatusKind] = useState<'info' | 'success' | 'error'>('info');

  const dirty = useMemo(() => openState === 'loaded' && saveState !== 'loading', [openState, saveState]);

  useEffect(() => {
    const token = readAccessTokenFromHashOrSession();
    setTokenPresent(Boolean(token));
  }, []);

  const refreshUser = useCallback(async () => {
    if (!tokenPresent) {
      setUser(null);
      setUserState('idle');
      return;
    }
    setUserState('loading');
    try {
      const me = await getMe();
      setUser(me);
      setUserState('loaded');
      setStatusKind('success');
      setStatus(`Welcome ${me.login}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setUser(null);
      setUserState('error');
      setStatusKind('error');
      setStatus('Login error. Please login again.');
      setTokenPresent(false);
      clearToken();
    }
  }, [tokenPresent]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const onOpen = useCallback(async () => {
    if (!owner || !repo || !path) {
      setStatusKind('error');
      setStatus('Owner, repo, and path are required');
      return;
    }
    setOpenState('loading');
    setStatusKind('info');
    setStatus('Opening file...');
    setSha(null);
    try {
      const data = await getFile(owner.trim(), repo.trim(), path.trim(), branch.trim() || 'main');
      if (!data || !data.content) throw new Error('No content returned');
      setSha(data.sha);
      const text = fromBase64Unicode(String(data.content).replace(/\n/g, ''));
      setContent(text);
      setOpenState('loaded');
      setStatusKind('success');
      setStatus(`Opened ${owner}/${repo}@${branch}:${path}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setOpenState('error');
      setStatusKind('error');
      if (err instanceof HttpError) {
        if (err.status === 404) setStatus('File not found or insufficient permissions');
        else if (err.status === 403) setStatus('Forbidden or rate limited. Try again later.');
        else setStatus(`Open failed: ${err.message}`);
      } else if (err instanceof Error) {
        setStatus(`Open failed: ${err.message}`);
      } else {
        setStatus('Open failed');
      }
    }
  }, [owner, repo, path, branch]);

  const onSave = useCallback(async () => {
    if (!owner || !repo || !path) {
      setStatusKind('error');
      setStatus('Owner, repo, and path are required');
      return;
    }
    if (!sha) {
      setStatusKind('error');
      setStatus('Missing file sha; please open the file again.');
      return;
    }
    const message = commitMsg.trim() || `Update ${path}`;
    setSaveState('loading');
    setStatusKind('info');
    setStatus('Saving...');
    try {
      const data = await putFile(
        owner.trim(),
        repo.trim(),
        path.trim(),
        branch.trim() || 'main',
        message,
        toBase64Unicode(content),
        sha,
      );
      const newSha = data?.content?.sha ?? null;
      setSha(newSha);
      setSaveState('loaded');
      setStatusKind('success');
      setStatus('Saved successfully.');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setSaveState('error');
      setStatusKind('error');
      if (err instanceof HttpError) {
        if (err.status === 409) setStatus('Conflict: file changed upstream. Re-open to refresh before saving.');
        else if (err.status === 403) setStatus('Forbidden or rate limited. Try again later.');
        else setStatus(`Save failed: ${err.message}`);
      } else if (err instanceof Error) {
        setStatus(`Save failed: ${err.message}`);
      } else {
        setStatus('Save failed');
      }
    }
  }, [owner, repo, path, branch, commitMsg, content, sha]);

  const onLogout = useCallback(() => {
    clearToken();
    setTokenPresent(false);
    setUser(null);
    setContent('');
    setSha(null);
    setCommitMsg('');
    setStatusKind('info');
    setStatus('Logged out');
  }, []);

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  return (
    <div className="container">
      <div className="card header">
        <h1 className="title">GitHub Editor</h1>
        <div className="auth">
          {user ? (
            <>
              <span className="muted">Logged in as {user.login}</span>
              <button className="btn ghost" onClick={onLogout} title="Clear token">Logout</button>
            </>
          ) : (
            <button className="btn primary" onClick={loginRedirect}>Login with GitHub</button>
          )}
        </div>
      </div>

      <hr />

      <div className="card">
        <div className="grid">
          <div className="field">
            <label htmlFor="owner">Owner</label>
            <input id="owner" className={`input${!owner ? ' invalid' : ''}`} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g. your-username" />
          </div>
          <div className="field">
            <label htmlFor="repo">Repo</label>
            <input id="repo" className={`input${!repo ? ' invalid' : ''}`} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="e.g. your-repo" />
          </div>
          <div className="field">
            <label htmlFor="branch">Branch</label>
            <input id="branch" className="input" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="e.g. main" />
          </div>
          <div className="field">
            <label htmlFor="path">Path</label>
            <input id="path" className={`input${!path ? ' invalid' : ''}`} value={path} onChange={(e) => setPath(e.target.value)} placeholder="e.g. README.md" />
          </div>
        </div>
        <div className="row section">
          <button className="btn" onClick={onOpen} disabled={!user || openState === 'loading'}>
            {openState === 'loading' ? <span className="row"><span className="spinner" /> Opening…</span> : 'Open file'}
          </button>
          <span className="muted">Tip: Save with <span className="kbd">Cmd/Ctrl+S</span></span>
        </div>
      </div>

      {openState === 'loaded' && (
        <div className="card section">
          <div className="field">
            <label htmlFor="commit">Commit message</label>
            <input id="commit" className="input" value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)} placeholder="e.g. Update README" />
          </div>
          <div className="section">
            <textarea
              className="textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="File content will appear here..."
            />
          </div>
          <div className="row section">
            <button className="btn primary" onClick={onSave} disabled={saveState === 'loading'}>
              {saveState === 'loading' ? <span className="row"><span className="spinner" /> Saving…</span> : 'Save (Commit)'}
            </button>
          </div>
        </div>
      )}

      <div className={`status ${statusKind}`}>{status}</div>
    </div>
  );
}


