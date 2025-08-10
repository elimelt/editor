import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Container, Paper, Group, Button, Title, Divider, Switch, Stack, Badge, ScrollArea, Grid, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { addRecentFile, getPinnedRepos, togglePinnedRepo } from '@/shared/recent';
import { CommandPalette } from '@/components/CommandPalette';
import { useDetectedLanguage } from '@/hooks/useDetectedLanguage';
import { SettingsDrawer } from '@/components/app/SettingsDrawer';
import { CreateFileModal } from '@/components/app/CreateFileModal';
import { ConfirmSaveModal } from '@/components/app/ConfirmSaveModal';
import { DeleteFileModal } from '@/components/app/DeleteFileModal';
import { ShortcutHints } from '@/components/app/ShortcutHints';

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
  const detectedLanguage = useDetectedLanguage(path);

  const [showPreview, setShowPreview] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const commitInputRef = useRef<HTMLInputElement | null>(null);

  // Subtle shortcut hints when Cmd/Ctrl is held outside the editor
  const [modifierHeld, setModifierHeld] = useState(false);
  const [focusInEditor, setFocusInEditor] = useState(false);

  const fileName = useMemo(() => (path ? path.split('/').pop() || path : ''), [path]);

  const layoutMode = useMemo(() => {
    if (showTree) return 'mode-tree';
    if (showPreview && detectedLanguage === 'markdown') return 'mode-preview';
    return 'mode-editor-only';
  }, [showTree, showPreview, detectedLanguage]);

  useEffect(() => {
    const token = readAccessTokenFromHashOrSession();
    setTokenPresent(Boolean(token));
  }, []);

  // Persist file tree visibility
  useEffect(() => {
    const stored = localStorage.getItem('ui_showTree');
    if (stored != null) setShowTree(stored === '1' || stored === 'true');
  }, []);
  useEffect(() => {
    localStorage.setItem('ui_showTree', showTree ? '1' : '0');
  }, [showTree]);

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

  // Reset file-specific UI when repo context changes
  useEffect(() => {
    setConfirmSaveOpen(false);
    setDeleteTarget(null);
    // close preview if not applicable
    if (!(openState === 'loaded' && detectedLanguage === 'markdown')) {
      setShowPreview(false);
    }
  }, [owner, repo, branch]);

  // Keep preview state consistent with file type and load state
  useEffect(() => {
    if (!(openState === 'loaded' && detectedLanguage === 'markdown')) {
      setShowPreview(false);
    }
  }, [openState, detectedLanguage]);

  // Enforce allowed layouts: editor-only OR editor+tree OR editor+preview
  useEffect(() => {
    if (showPreview) {
      setShowTree(false);
    }
  }, [showPreview]);
  useEffect(() => {
    if (showTree) {
      setShowPreview(false);
    }
  }, [showTree]);

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
        // New file (draft) -> create
        const { createFile } = await import('@/api/github');
        data = await createFile(
          owner.trim(),
          repo.trim(),
          path.trim(),
          branch.trim() || 'main',
          message,
          toBase64Unicode(content),
        );
      } else {
        // Existing file -> update
        data = await putFile(
          owner.trim(),
          repo.trim(),
          path.trim(),
          branch.trim() || 'main',
          message,
          toBase64Unicode(content),
          sha,
        );
      }
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

  const openConfirmSave = useCallback(() => {
    if (openState !== 'loaded' || !sha) return;
    setCommitMsg((prev) => (prev && prev.trim()) ? prev : `Update ${path}`);
    setConfirmSaveOpen(true);
  }, [openState, sha, path]);

  const onLogout = useCallback(() => {
    clearToken();
    setTokenPresent(false);
    setUser(null);
    setContent('');
    setSha(null);
    setCommitMsg('');
    setStatusKind('info');
    setStatus('Logged out');
    // Close overlays and reset transient UI state
    setPaletteOpen(false);
    setSettingsOpen(false);
    setCreateOpen(false);
    setConfirmSaveOpen(false);
    setDeleteTarget(null);
    setShowPreview(false);
    setOpenState('idle');
    setPath('');
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
        openConfirmSave();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        if (openState === 'loaded' && detectedLanguage === 'markdown') {
          setShowPreview((v) => !v);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        if (openState === 'loaded' && detectedLanguage === 'markdown') {
          setShowPreview((v) => !v);
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setShowTree((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener('open-settings' as any, openSettings);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSave, openConfirmSave, openState, detectedLanguage]);

  // Detect modifier key hold and editor focus to show shortcut hints
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') {
        setModifierHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') {
        setModifierHeld(false);
      }
      // If all keys released, clear state defensively
      if (!e.ctrlKey && !e.metaKey) setModifierHeld(false);
    };
    const handleFocusChange = () => {
      const active = document.activeElement as HTMLElement | null;
      const inEditor = Boolean(active?.closest('.cm-editor'));
      setFocusInEditor(inEditor);
    };
    window.addEventListener('keydown', handleKeyDown, { passive: true });
    window.addEventListener('keyup', handleKeyUp, { passive: true });
    document.addEventListener('focusin', handleFocusChange, { passive: true });
    document.addEventListener('focusout', handleFocusChange, { passive: true });
    // Initialize on mount
    handleFocusChange();
    return () => {
      window.removeEventListener('keydown', handleKeyDown as any);
      window.removeEventListener('keyup', handleKeyUp as any);
      document.removeEventListener('focusin', handleFocusChange as any);
      document.removeEventListener('focusout', handleFocusChange as any);
    };
  }, []);

  return (
    <Container size="lg" py="lg">
      <Paper withBorder p="md" radius="md" className="header">
        <Group justify="space-between" wrap="wrap">
          <Group gap="sm">
            <Title order={2}>GitHub Editor</Title>
            {openState === 'loaded' && (
              <Button variant="light" onClick={() => setShowTree((v) => !v)} title="Toggle file tree (Cmd/Ctrl+B)">
                {showTree ? 'Hide files' : 'Show files'}
              </Button>
            )}
          </Group>
          <Group>
            <Button variant="light" onClick={() => setPaletteOpen(true)} title="Command palette (Cmd/Ctrl+K or Cmd/Ctrl+P)">Command palette</Button>
            <Button variant="subtle" onClick={() => setSettingsOpen(true)} title="Settings (Cmd/Ctrl+,)" disabled={!user}>Settings</Button>
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

      {/* spacing managed by Paper margins; removed hr to reduce visual clutter */}

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
                        setStatusKind('info');
                        setStatus(`Selected ${r.fullName}`);
                        // Open blank editor with file tree by default
                        setShowTree(true);
                        setOpenState('loaded');
                        setPath('');
                        setContent('');
                        setSha('');
                      }}
                      title={r.desc || r.fullName}
                    >
                      {r.fullName}
                    </Button>
                  </Group>
                ))}
              {repos.length === 0 && (
                <div className="muted">No editable repositories found.</div>
              )}
            </Group>
            <Divider my="md" />
          </>
        )}
        <SettingsDrawer
          opened={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          owner={owner}
          setOwner={setOwner}
          repo={repo}
          setRepo={setRepo}
          branch={branch}
          setBranch={setBranch}
          path={path}
          setPath={setPath}
          onOpenFile={() => { void onOpen(); setSettingsOpen(false); }}
          canOpen={Boolean(user && owner && repo && path)}
        />
      </Paper>

      {(owner && repo) && (
        <div className="section">
          <Grid gutter="md" align="stretch">
            {/* File tree column */}
            {layoutMode === 'mode-tree' && (
              <Grid.Col span={{ base: 12, md: 5, lg: 4, xl: 3 }}>
                <Paper withBorder p="md" radius="md" className="filetree">
                  <FileTree
                    owner={owner}
                    repo={repo}
                    branch={branch}
                    onSelectFile={(p) => {
                      setPath(p);
                      void onOpen(p);
                    }}
                    onCreate={() => setCreateOpen(true)}
                    onDelete={(p) => setDeleteTarget(p)}
                  />
                </Paper>
              </Grid.Col>
            )}

            {/* Editor column */}
            <Grid.Col span={{ base: 12, md: openState === 'loaded' ? 12 : 0, lg: openState === 'loaded' ? (layoutMode === 'mode-preview' ? 6 : layoutMode === 'mode-tree' ? 8 : 12) : 0, xl: openState === 'loaded' ? (layoutMode === 'mode-preview' ? 6 : layoutMode === 'mode-tree' ? 9 : 12) : 0 }}>
              {openState === 'loaded' && (
              <Paper withBorder p="md" radius="md" className="editor-card">
                <Stack className="editor-stack">
              {openState === 'loaded' && !!fileName && (
                <Group justify="space-between" align="center" className="tree-header">
                  <strong className="tree-title">{fileName}</strong>
                  {detectedLanguage === 'markdown' && (
                    <Switch
                      checked={showPreview}
                      onChange={(e) => setShowPreview(e.currentTarget.checked)}
                      label="Split preview"
                    />
                  )}
                </Group>
              )}
              <div className="editor-host">
                <CodeEditor
                  value={content}
                  onChange={setContent}
                  language={detectedLanguage}
                  softWrap={detectedLanguage === 'markdown' || detectedLanguage === 'text'}
                  height={undefined as any}
                  wrapColumn={detectedLanguage === 'markdown' && showPreview ? undefined : 96}
                />
              </div>
                <Group>
                  <Button onClick={openConfirmSave} loading={saveState === 'loading'} disabled={saveState === 'loading' || !sha}>
                    {saveState === 'loading' ? 'Saving…' : 'Save (Commit)'}
                  </Button>
                </Group>
                </Stack>
              </Paper>
              )}
            </Grid.Col>

            {/* Preview column */}
            {(layoutMode === 'mode-preview' && openState === 'loaded') && (
            <Grid.Col span={{ base: 12, md: 12, lg: 6, xl: 6 }}>
              {(layoutMode === 'mode-preview' && openState === 'loaded') && (
              <Paper withBorder p="md" radius="md" className="preview-card">
                <ScrollArea className="preview-scroll" type="auto">
                  <MarkdownPreview markdown={content} />
                </ScrollArea>
              </Paper>
              )}
            </Grid.Col>
            )}
          </Grid>
        </div>
      )}

      <div className={`status ${statusKind}`}>{status}</div>
      {/* Keyboard shortcut hints: shown when modifier is held outside editor */}
      <ShortcutHints
        show={modifierHeld && !focusInEditor}
        showToggleFiles={openState === 'loaded'}
        showTogglePreview={openState === 'loaded' && detectedLanguage === 'markdown'}
      />
      <CreateFileModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        newPath={newPath}
        setNewPath={setNewPath}
        onCreate={async () => {
          if (!owner || !repo || !newPath.trim()) return;
          try {
            const initialContent = '';
            const { createFile, toBase64Unicode } = await import('@/api/github');
            await createFile(owner, repo, newPath.trim(), branch || 'main', `Create ${newPath.trim()}`, toBase64Unicode(initialContent));
            setCreateOpen(false);
            setPath(newPath.trim());
            setContent(initialContent);
            setSha('');
            notifications.show({ color: 'green', title: 'Created', message: newPath.trim() });
          } catch (e) {
            notifications.show({ color: 'red', title: 'Create failed', message: e instanceof Error ? e.message : 'Error' });
          }
        }}
        canCreate={Boolean(newPath.trim())}
      />
      <ConfirmSaveModal
        opened={confirmSaveOpen}
        onClose={() => setConfirmSaveOpen(false)}
        commitMsg={commitMsg}
        setCommitMsg={setCommitMsg}
        onConfirm={() => { void onSave(commitMsg); setConfirmSaveOpen(false); }}
        loading={saveState === 'loading'}
        canConfirm={Boolean(owner && repo && path)}
        commitInputRef={commitInputRef}
        pathForPlaceholder={path}
      />
      <DeleteFileModal
        opened={Boolean(deleteTarget)}
        filePath={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        loading={saveState === 'loading'}
        onConfirm={async () => {
          if (!owner || !repo || !deleteTarget || !sha) return;
          try {
            const { deleteFile } = await import('@/api/github');
            await deleteFile(owner, repo, deleteTarget, branch || 'main', `Delete ${deleteTarget}`, sha);
            notifications.show({ color: 'green', title: 'Deleted', message: deleteTarget });
            setDeleteTarget(null);
            setContent('');
            setSha(null);
            setOpenState('idle');
          } catch (e) {
            notifications.show({ color: 'red', title: 'Delete failed', message: e instanceof Error ? e.message : 'Error' });
          }
        }}
      />
      <CommandPalette
        opened={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        owner={owner}
        repo={repo}
        branch={branch}
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
        onOpenPath={(p) => {
          setPath(p);
          void onOpen(p);
          setPaletteOpen(false);
        }}
        onTogglePreview={() => setShowPreview((v) => !v)}
      />
    </Container>
  );
}


