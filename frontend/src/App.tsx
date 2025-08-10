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
import { FileTree } from '@/components/FileTree';
import { Badge, Button, Container, Grid, Group, Paper, ScrollArea, Stack, Switch, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { addRecentFile, getPinnedRepos, togglePinnedRepo } from '@/shared/recent';
import { CommandPalette } from '@/components/CommandPalette';
import { useDetectedLanguage } from '@/hooks/useDetectedLanguage';
import { SettingsDrawer } from '@/components/app/SettingsDrawer';
import { CreateFileModal } from '@/components/app/CreateFileModal';
import { ConfirmSaveModal } from '@/components/app/ConfirmSaveModal';
import { DeleteFileModal } from '@/components/app/DeleteFileModal';
import { ShortcutHints } from '@/components/app/ShortcutHints';
import { RepoPicker } from '@/components/app/RepoPicker';
import { HeaderBar } from '@/components/app/HeaderBar';
import { EditorPanel } from '@/components/app/EditorPanel';
import { PreviewPanel } from '@/components/app/PreviewPanel';
import { StatusBar } from '@/components/app/StatusBar';
import { useWarnOnUnload } from '@/hooks/useWarnOnUnload';
import { useModifierAndEditorFocus } from '@/hooks/useModifierAndEditorFocus';
import { usePersistentBoolean } from '@/hooks/usePersistentBoolean';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import { usePreviewGuards } from '@/hooks/usePreviewGuards';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { CodeEditor } from './components/CodeEditor';
import { MarkdownPreview } from './components/MarkdownPreview';

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
  const [showTree, setShowTree] = usePersistentBoolean('ui_showTree', false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const commitInputRef = useRef<HTMLInputElement | null>(null);

  const { modifierHeld, focusInEditor } = useModifierAndEditorFocus();

  const fileName = useMemo(() => (path ? path.split('/').pop() || path : ''), [path]);

  const layoutMode = useLayoutMode(showTree, showPreview, detectedLanguage);

  useEffect(() => {
    const token = readAccessTokenFromHashOrSession();
    setTokenPresent(Boolean(token));
  }, []);

  // (persist handled by usePersistentBoolean)

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

  usePreviewGuards(openState, detectedLanguage, setShowPreview);

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

  useWarnOnUnload(dirty);

  useEffect(() => {
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener('open-settings' as any, openSettings);
    return () => window.removeEventListener('open-settings' as any, openSettings as any);
  }, []);
  useGlobalShortcuts({
    onSave: openConfirmSave,
    onOpenPalette: () => setPaletteOpen(true),
    onTogglePreview: () => setShowPreview((v) => !v),
    onToggleFiles: () => setShowTree((v) => !v),
    onOpenSettings: () => setSettingsOpen(true),
    isMarkdownPreviewAvailable: openState === 'loaded' && detectedLanguage === 'markdown',
  });

  // (modifier/focus handled by useModifierAndEditorFocus)

  return (
    <Container size="lg" py="lg">
      <HeaderBar
        canToggleFiles={openState === 'loaded'}
        showTree={showTree}
        onToggleFiles={() => setShowTree((v) => !v)}
        userLogin={user?.login ?? null}
        onLogin={loginRedirect}
        onLogout={onLogout}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* spacing managed by Paper margins; removed hr to reduce visual clutter */}

      <Paper withBorder p="md" radius="md" mt="md">
        {!!user && (
          <RepoPicker
            userLogin={user?.login}
            repos={repos}
            repoQuery={repoQuery}
            setRepoQuery={setRepoQuery}
            onLoadPins={() => {
              const pins = getPinnedRepos();
              setRepos((old) => {
                const set = new Set(old.map((o) => `${o.owner}/${o.name}`));
                const added = pins
                  .filter((p) => !set.has(`${p.owner}/${p.repo}`))
                  .map((p) => ({ owner: p.owner, name: p.repo, fullName: `${p.owner}/${p.repo}`, defaultBranch: 'main' as string, desc: '' }));
                return [...added, ...old];
              });
            }}
            onSelectRepo={(r) => {
              setOwner(r.owner);
              setRepo(r.name);
              setBranch(r.defaultBranch || 'main');
              setStatusKind('info');
              setStatus(`Selected ${r.fullName}`);
              setShowTree(true);
              setOpenState('loaded');
              setPath('');
              setContent('');
              setSha('');
            }}
          />
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
              <EditorPanel
                open={openState === 'loaded'}
                fileName={fileName}
                language={detectedLanguage}
                value={content}
                onChange={setContent}
                showPreviewToggle={detectedLanguage === 'markdown'}
                showPreview={showPreview}
                onTogglePreview={(v) => setShowPreview(v)}
                wrapColumn={detectedLanguage === 'markdown' && showPreview ? undefined : 96}
                onSaveClick={openConfirmSave}
                isSaving={saveState === 'loading'}
                canSave={saveState !== 'loading' && Boolean(sha)}
              />
            </Grid.Col>

            {/* Preview column */}
            {(layoutMode === 'mode-preview' && openState === 'loaded') && (
              <Grid.Col span={{ base: 12, md: 12, lg: 6, xl: 6 }}>
                <PreviewPanel open={true} markdown={content} />
              </Grid.Col>
            )}
          </Grid>
        </div>
      )}

      <StatusBar kind={statusKind} text={status} />
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


