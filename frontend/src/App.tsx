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
  listEditableRepos,
} from '@/api/github';
import { CodeEditor } from '@/components/CodeEditor';
import { FileTree } from '@/components/FileTree';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { Container, Paper, Group, Button, TextInput, SimpleGrid, Title, Divider, Switch, Stack, Badge, ScrollArea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { addRecentFile, getPinnedRepos, togglePinnedRepo } from '@/shared/recent';
import { CommandPalette } from '@/components/CommandPalette';

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

  const [repos, setRepos] = useState<Array<{ owner: string; name: string; fullName: string; defaultBranch: string; desc?: string | null }>>([]);
  const [repoQuery, setRepoQuery] = useState('');

  const dirty = useMemo(() => openState === 'loaded' && saveState !== 'loading', [openState, saveState]);
  const detectedLanguage = useMemo<
    'markdown' | 'javascript' | 'typescript' | 'html' | 'css' | 'json' | 'python' | 'text'
  >(() => {
    const lower = path.toLowerCase();
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
    if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
    if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'javascript';
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
    if (lower.endsWith('.css')) return 'css';
    if (lower.endsWith('.py')) return 'python';
    return 'text';
  }, [path]);

  const [showPreview, setShowPreview] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

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
      // Load repos in background
      try {
        const list = await listEditableRepos(30);
        setRepos(
          list.map((r) => ({ owner: r.owner.login, name: r.name, fullName: r.full_name, defaultBranch: r.default_branch, desc: r.description }))
        );
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
      notifications.show({ color: 'green', title: 'Saved', message: `${owner}/${repo}:${path}` });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setSaveState('error');
      setStatusKind('error');
      if (err instanceof HttpError) {
        if (err.status === 409) setStatus('Conflict: file changed upstream. Re-open to refresh before saving.');
        else if (err.status === 403) setStatus('Forbidden or rate limited. Try again later.');
        else setStatus(`Save failed: ${err.message}`);
        notifications.show({ color: 'red', title: 'Save failed', message: `${err.status} ${err.statusText}` });
      } else if (err instanceof Error) {
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        void onSave();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSave]);

  return (
    <Container size="lg" py="lg">
      <Paper withBorder p="md" radius="md" className="header">
        <Group justify="space-between" wrap="wrap">
          <Title order={2}>GitHub Editor</Title>
          <Group>
            <Button variant="light" onClick={() => setPaletteOpen(true)} title="Command palette (Cmd/Ctrl+K)">Command palette</Button>
            {user ? (
              <>
                <Badge variant="light" color="gray">{user.login}</Badge>
                <Button variant="subtle" onClick={onLogout} title="Clear token">Logout</Button>
              </>
            ) : (
              <Button onClick={loginRedirect}>Login with GitHub</Button>
            )}
          </Group>
        </Group>
      </Paper>

      <hr />

      <Paper withBorder p="md" radius="md" mt="md">
        {!!user && (
          <>
            <Group justify="space-between" align="center">
              <Group>
                <strong>Your repos</strong>
                <Button variant="subtle" onClick={() => {
                  const pins = getPinnedRepos();
                  setRepos((old) => {
                    const set = new Set(old.map((o) => `${o.owner}/${o.name}`));
                    const added = pins.filter((p) => !set.has(`${p.owner}/${p.repo}`)).map((p) => ({ owner: p.owner, name: p.repo, fullName: `${p.owner}/${p.repo}`, defaultBranch: 'main' as string, desc: '' }));
                    return [...added, ...old];
                  });
                }}>Load pins</Button>
              </Group>
              <TextInput
                placeholder="Search repos..."
                value={repoQuery}
                onChange={(e) => setRepoQuery(e.currentTarget.value)}
                aria-label="Search repositories"
                maw={320}
              />
            </Group>
            <Group mt="sm" gap="xs" role="list" aria-label="Editable repositories" wrap="wrap">
              {repos
                .filter((r) => {
                  const q = repoQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    r.fullName.toLowerCase().includes(q) ||
                    (r.desc ? r.desc.toLowerCase().includes(q) : false)
                  );
                })
                .slice(0, 10)
                .map((r) => (
                  <Group key={r.fullName} gap={4} wrap="nowrap">
                    <Button
                      variant="light"
                      role="listitem"
                      onClick={() => {
                        setOwner(r.owner);
                        setRepo(r.name);
                        setBranch(r.defaultBranch || 'main');
                        setPath('README.md');
                        setStatusKind('info');
                        setStatus(`Selected ${r.fullName}`);
                      }}
                      title={r.desc || r.fullName}
                    >
                      {r.fullName}
                    </Button>
                    <Button variant="subtle" onClick={() => togglePinnedRepo(r.owner, r.name)} title="Pin/unpin">★</Button>
                  </Group>
                ))}
              {repos.length === 0 && (
                <div className="muted">No editable repositories found.</div>
              )}
            </Group>
            <Divider my="md" />
          </>
        )}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Stack gap={6}>
            <TextInput label="Owner" id="owner" value={owner} onChange={(e) => setOwner(e.currentTarget.value)} placeholder="e.g. your-username" error={!owner ? 'Required' : undefined} />
            <TextInput label="Repo" id="repo" value={repo} onChange={(e) => setRepo(e.currentTarget.value)} placeholder="e.g. your-repo" error={!repo ? 'Required' : undefined} />
          </Stack>
          <Stack gap={6}>
            <TextInput label="Branch" id="branch" value={branch} onChange={(e) => setBranch(e.currentTarget.value)} placeholder="e.g. main" />
            <TextInput label="Path" id="path" value={path} onChange={(e) => setPath(e.currentTarget.value)} placeholder="e.g. README.md" error={!path ? 'Required' : undefined} />
          </Stack>
        </SimpleGrid>
        <Group mt="md" justify="space-between">
          <Button onClick={() => void onOpen()} loading={openState === 'loading'} disabled={!user}>Open file</Button>
          <span className="muted">Tip: Save with <span className="kbd">Cmd/Ctrl+S</span></span>
        </Group>
      </Paper>

      {openState === 'loaded' && (
        <div className={`section editor-layout ${detectedLanguage === 'markdown' && showPreview ? 'with-preview' : ''}`}>
          <Paper withBorder p="md" radius="md" className="filetree">
            <FileTree
              owner={owner}
              repo={repo}
              branch={branch}
              onSelectFile={(p) => {
                setPath(p);
                void onOpen(p);
              }}
            />
          </Paper>
          <Paper withBorder p="md" radius="md" className="editor-card">
            <Stack>
              <TextInput label="Commit message" id="commit" value={commitMsg} onChange={(e) => setCommitMsg(e.currentTarget.value)} placeholder="e.g. Update README" />
              {detectedLanguage === 'markdown' && (
                <Group justify="flex-end">
                  <Switch checked={showPreview} onChange={(e) => setShowPreview(e.currentTarget.checked)} label="Split preview" />
                </Group>
              )}
              <ScrollArea h={600} type="auto">
                <CodeEditor
                  value={content}
                  onChange={setContent}
                  language={detectedLanguage}
                  softWrap={detectedLanguage === 'markdown' || detectedLanguage === 'text'}
                />
              </ScrollArea>
              <Group>
                <Button onClick={onSave} loading={saveState === 'loading'}>Save (Commit)</Button>
              </Group>
            </Stack>
          </Paper>
          {detectedLanguage === 'markdown' && showPreview && (
            <Paper withBorder p="md" radius="md" className="preview-card">
              <ScrollArea h={600} type="auto">
                <MarkdownPreview markdown={content} />
              </ScrollArea>
            </Paper>
          )}
        </div>
      )}

      <div className={`status ${statusKind}`}>{status}</div>
      <CommandPalette
        opened={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenFile={(f) => {
          setOwner(f.owner);
          setRepo(f.repo);
          setBranch(f.branch);
          setPath(f.path);
          void onOpen(f.path);
          setPaletteOpen(false);
        }}
        onOpenRepo={(r) => {
          setOwner(r.owner);
          setRepo(r.repo);
          setBranch('main');
          setPath('README.md');
          setPaletteOpen(false);
        }}
        onTogglePreview={() => setShowPreview((v) => !v)}
      />
    </Container>
  );
}


