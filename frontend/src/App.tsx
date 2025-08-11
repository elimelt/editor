import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearToken, fromBase64Unicode, getFile, getMe, HttpError, listEditableRepos, loginRedirect, putFile, readAccessTokenFromHashOrSession, toBase64Unicode } from '@/api/github';
import { FileTree } from '@/components/FileTree';
import { Badge, Button, Container, Group, Paper, ScrollArea, Stack, Switch, Title } from '@mantine/core';
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
import { useEditorController } from '@/hooks/useEditorController';

export function App(): JSX.Element {
  const {
    tokenPresent,
    user,
    userState,
    onLogout,
    owner, setOwner,
    repo, setRepo,
    branch, setBranch,
    path, setPath,
    content, setContent,
    sha, setSha,
    commitMsg, setCommitMsg,
    openState, setOpenState,
    saveState, setSaveState,
    status, setStatus,
    statusKind, setStatusKind,
    repos, setRepos,
    repoQuery, setRepoQuery,
    onOpen,
    onSave,
  } = useEditorController();

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

  const isRestoringFromHistoryRef = useRef(false);
  const pendingOpenPathRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const o = params.get('owner') || '';
    const r = params.get('repo') || '';
    const b = params.get('branch') || 'main';
    const p = params.get('path') || '';
    if (o && r) {
      isRestoringFromHistoryRef.current = true;
      setOwner(o);
      setRepo(r);
      setBranch(b || 'main');
      if (p) {
        setPath(p);
        pendingOpenPathRef.current = p;
      } else {
        setOpenState('loaded');
      }
      queueMicrotask(() => { isRestoringFromHistoryRef.current = false; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingOpenPathRef.current) return;
    if (!owner || !repo) return;
    if (!tokenPresent) return;
    const toOpen = pendingOpenPathRef.current;
    pendingOpenPathRef.current = null;
    void onOpen(toOpen);
  }, [owner, repo, branch, tokenPresent, onOpen]);

  useEffect(() => {
    if (isRestoringFromHistoryRef.current) return;
    if (!owner || !repo) return;
    const params = new URLSearchParams();
    params.set('owner', owner);
    params.set('repo', repo);
    if (branch) params.set('branch', branch);
    if (path) params.set('path', path);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.pushState(null, '', nextUrl);
    }
  }, [owner, repo, branch, path]);

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const o = params.get('owner') || '';
      const r = params.get('repo') || '';
      const b = params.get('branch') || 'main';
      const p = params.get('path') || '';
      isRestoringFromHistoryRef.current = true;
      setOwner(o);
      setRepo(r);
      setBranch(b || 'main');
      setPath(p);
      if (o && r && p) {
        pendingOpenPathRef.current = p;
      } else if (o && r) {
        setOpenState('loaded');
        setContent('');
        setSha('');
      } else {
        setOpenState('idle');
        setContent('');
        setSha(null);
      }
      queueMicrotask(() => { isRestoringFromHistoryRef.current = false; });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [onOpen, setOwner, setRepo, setBranch, setPath, setOpenState, setContent, setSha]);

  useEffect(() => {
    setConfirmSaveOpen(false);
    setDeleteTarget(null);
    if (!(openState === 'loaded' && detectedLanguage === 'markdown')) {
      setShowPreview(false);
    }
  }, [owner, repo, branch]);

  usePreviewGuards(openState, detectedLanguage, setShowPreview);

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

  const openConfirmSave = useCallback(() => {
    if (openState !== 'loaded' || !sha) return;
    setCommitMsg((prev) => (prev && prev.trim()) ? prev : `Update ${path}`);
    setConfirmSaveOpen(true);
  }, [openState, sha, path]);

  const onLogoutAndReset = useCallback(() => {
    setPaletteOpen(false);
    setSettingsOpen(false);
    setCreateOpen(false);
    setConfirmSaveOpen(false);
    setDeleteTarget(null);
    setShowPreview(false);
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
        <div className={`section editor-layout ${layoutMode}`}>
          <div className="slot-tree">
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
          </div>

          <div className="slot-editor">
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
          </div>

          <div className="slot-preview">
            <PreviewPanel open={openState === 'loaded' && layoutMode === 'mode-preview'} markdown={content} />
          </div>
        </div>
      )}

      <StatusBar kind={statusKind} text={status} />
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


