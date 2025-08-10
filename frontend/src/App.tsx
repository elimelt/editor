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
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setUser(null);
      setUserState('error');
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
      setStatus('Owner, repo, and path are required');
      return;
    }
    setOpenState('loading');
    setStatus('Opening file...');
    setSha(null);
    try {
      const data = await getFile(owner.trim(), repo.trim(), path.trim(), branch.trim() || 'main');
      if (!data || !data.content) throw new Error('No content returned');
      setSha(data.sha);
      const text = fromBase64Unicode(String(data.content).replace(/\n/g, ''));
      setContent(text);
      setOpenState('loaded');
      setStatus(`Opened ${owner}/${repo}@${branch}:${path}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setOpenState('error');
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
      setStatus('Owner, repo, and path are required');
      return;
    }
    if (!sha) {
      setStatus('Missing file sha; please open the file again.');
      return;
    }
    const message = commitMsg.trim() || `Update ${path}`;
    setSaveState('loading');
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
      setStatus('Saved successfully.');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setSaveState('error');
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
      <h1>GitHub Editor</h1>

      <section>
        {user ? (
          <>
            <div>Logged in as {user.login}</div>
            <button onClick={onLogout}>Logout</button>
          </>
        ) : (
          <button onClick={loginRedirect}>Login with GitHub</button>
        )}
      </section>

      <hr />

      <section>
        <div>
          <label>
            Owner:{' '}
            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g. your-username" />
          </label>
        </div>
        <div>
          <label>
            Repo:{' '}
            <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="e.g. your-repo" />
          </label>
        </div>
        <div>
          <label>
            Branch:{' '}
            <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="e.g. main" />
          </label>
        </div>
        <div>
          <label>
            Path:{' '}
            <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="e.g. README.md" />
          </label>
        </div>
        <div>
          <button onClick={onOpen} disabled={!user || openState === 'loading'}>
            {openState === 'loading' ? 'Opening…' : 'Open file'}
          </button>
        </div>
      </section>

      {openState === 'loaded' && (
        <section className="section">
          <div>
            <label>
              Commit message:{' '}
              <input value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)} placeholder="e.g. Update README" />
            </label>
          </div>
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={24}
              cols={100}
              placeholder="File content will appear here..."
            />
          </div>
          <div>
            <button onClick={onSave} disabled={saveState === 'loading'}>
              {saveState === 'loading' ? 'Saving…' : 'Save (Commit)'}
            </button>
          </div>
        </section>
      )}

      <div className="status">{status}</div>
    </div>
  );
}


