import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  listEditableRepos,
} from '@/api/github';
import { notifications } from '@mantine/notifications';
import { addRecentFile, getPinnedRepos } from '@/shared/recent';

export type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

export type RepoSummary = { owner: string; name: string; fullName: string; defaultBranch: string; desc?: string | null };

export function useEditorController() {
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

  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [repoQuery, setRepoQuery] = useState('');

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
      try {
        const list = await listEditableRepos(30);
        setRepos(list.map((r) => ({ owner: r.owner.login, name: r.name, fullName: r.full_name, defaultBranch: r.default_branch, desc: r.description })));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load repos', e);
      }
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

  const onOpen = useCallback(async (overridePath?: string) => {
    if (!owner || !repo || !(overridePath || path)) {
      setStatusKind('error');
      setStatus('Owner, repo, and path are required');
      return;
    }
    setOpenState('loading');
    setStatusKind('info');
    setStatus('Opening file...');
    setSha(null);
    try {
      const data = await getFile(owner.trim(), repo.trim(), (overridePath || path).trim(), branch.trim() || 'main');
      if (!data || !data.content) throw new Error('No content returned');
      setSha(data.sha);
      const text = fromBase64Unicode(String(data.content).replace(/\n/g, ''));
      setContent(text);
      setOpenState('loaded');
      setStatusKind('success');
      setStatus(`Opened ${owner}/${repo}@${branch}:${overridePath || path}`);
      addRecentFile({ owner, repo, branch, path: overridePath || path });
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

  const onSave = useCallback(async (messageOverride?: string) => {
    if (!owner || !repo || !path) {
      setStatusKind('error');
      setStatus('Owner, repo, and path are required');
      return;
    }
    const message = (messageOverride ?? commitMsg.trim()) || `Update ${path}`;
    setSaveState('loading');
    setStatusKind('info');
    setStatus('Saving...');
    try {
      let data: any;
      if (!sha) {
        const { createFile } = await import('@/api/github');
        data = await createFile(owner.trim(), repo.trim(), path.trim(), branch.trim() || 'main', message, toBase64Unicode(content));
      } else {
        data = await putFile(owner.trim(), repo.trim(), path.trim(), branch.trim() || 'main', message, toBase64Unicode(content), sha);
      }
      const newSha = data?.content?.sha ?? null;
      setSha(newSha);
      setSaveState('loaded');
      setStatusKind('success');
      setStatus('Saved successfully.');
      notifications.show({ color: 'green', title: 'Saved', message: `${owner}/${repo}:${path}` });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setSaveState('error');
      setStatusKind('error');
      if (err instanceof HttpError) {
        if (err.status === 409) setStatus('Conflict: file changed upstream. Re-open to refresh before saving.');
        else if (err.status === 403) setStatus('Forbidden or rate limited. Try again later.');
        else setStatus(`Save failed: ${err.message}`);
        notifications.show({ color: 'red', title: 'Save failed', message: `${err.status} ${err.statusText}` });
      } else if (err?.message) {
        setStatus(`Save failed: ${err.message}`);
        notifications.show({ color: 'red', title: 'Save failed', message: err.message });
      } else {
        setStatus('Save failed');
        notifications.show({ color: 'red', title: 'Save failed', message: 'Unknown error' });
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
    setOpenState('idle');
    setPath('');
  }, []);

  const selectRepo = useCallback((r: RepoSummary) => {
    setOwner(r.owner);
    setRepo(r.name);
    setBranch(r.defaultBranch || 'main');
    setStatusKind('info');
    setStatus(`Selected ${r.fullName}`);
    setOpenState('loaded');
    setPath('');
    setContent('');
    setSha('');
  }, []);

  return {
    // auth/user
    tokenPresent,
    user,
    userState,
    refreshUser,
    onLogout,
    // repo & file context
    owner, setOwner,
    repo, setRepo,
    branch, setBranch,
    path, setPath,
    // content & commit
    content, setContent,
    sha, setSha,
    commitMsg, setCommitMsg,
    // states & status
    openState, setOpenState,
    saveState, setSaveState,
    status, setStatus,
    statusKind, setStatusKind,
    // repos list and actions
    repos, setRepos,
    repoQuery, setRepoQuery,
    selectRepo,
    // operations
    onOpen,
    onSave,
  } as const;
}


