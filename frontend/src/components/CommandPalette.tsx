import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, TextInput, Group, Button, Stack, Badge, Divider } from '@mantine/core';
import { getRecentFiles, getPinnedRepos, PinnedRepo, RecentFile } from '@/shared/recent';
import { listDirectory, GitHubDirEntry } from '@/api/github';

type Props = {
  opened: boolean;
  onClose: () => void;
  onOpenFile: (f: RecentFile) => void;
  onOpenRepo: (r: PinnedRepo) => void;
  onOpenPath: (path: string) => void;
  onTogglePreview: () => void;
  owner?: string;
  repo?: string;
  branch?: string;
};

export function CommandPalette({ opened, onClose, onOpenFile, onOpenRepo, onOpenPath, onTogglePreview, owner, repo, branch }: Props) {
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<RecentFile[]>([]);
  const [pinned, setPinned] = useState<PinnedRepo[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (opened) {
      setRecent(getRecentFiles());
      setPinned(getPinnedRepos());
      if (owner && repo) {
        setLoadingFiles(true);
        void (async () => {
          const seen = new Set<string>();
          const acc: string[] = [];
          async function walk(prefix: string, depth: number) {
            try {
              const entries: GitHubDirEntry[] = await listDirectory(owner!, repo!, prefix, branch || '');
              for (const e of entries) {
                if (seen.has(e.path)) continue;
                seen.add(e.path);
                if (e.type === 'file') acc.push(e.path);
                if (e.type === 'dir' && depth > 0 && acc.length < 500) {
                  await walk(e.path, depth - 1);
                }
              }
            } catch {
              /* ignore */
            }
          }
          await walk('', 2);
          setFiles(acc.slice(0, 500));
          setLoadingFiles(false);
        })();
      } else {
        setFiles([]);
      }
    }
  }, [opened, owner, repo, branch]);

  useEffect(() => {
    if (opened) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [opened]);

  const filteredRecent = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return recent.slice(0, 10);
    return recent.filter((f) => `${f.owner}/${f.repo}:${f.path}`.toLowerCase().includes(s)).slice(0, 10);
  }, [recent, q]);

  const filteredPinned = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return pinned.slice(0, 10);
    return pinned.filter((r) => `${r.owner}/${r.repo}`.toLowerCase().includes(s)).slice(0, 10);
  }, [pinned, q]);

  const filteredFiles = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return files.slice(0, 20);
    return files.filter((p) => p.toLowerCase().includes(s)).slice(0, 50);
  }, [files, q]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Command palette (Cmd/Ctrl+K)"
      size="lg"
      withinPortal
      trapFocus
      onEnterTransitionEnd={() => inputRef.current?.focus()}
    >
      <Stack>
        <TextInput
          placeholder="Type to search (files / recent / pinned). Enter to open first result"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const first = (owner && repo && filteredFiles[0])
                ? { type: 'file', v: filteredFiles[0] as string }
                : (filteredRecent[0] ? { type: 'recent', v: filteredRecent[0] } : (filteredPinned[0] ? { type: 'pinned', v: filteredPinned[0] } : null));
              if (first) {
                if (first.type === 'file') onOpenPath(first.v as string);
                if (first.type === 'recent') onOpenFile(first.v as any);
                if (first.type === 'pinned') onOpenRepo(first.v as any);
              }
            }
          }}
          autoFocus
          ref={inputRef}
        />
        <Group gap="xs" wrap="wrap">
          <Badge variant="light" onClick={() => onTogglePreview()} style={{ cursor: 'pointer' }}>Toggle preview</Badge>
          <Badge variant="light" onClick={() => { (document.activeElement as HTMLElement)?.blur(); }} style={{ cursor: 'pointer' }}>Dismiss</Badge>
          <Badge variant="light" onClick={() => { const ev = new CustomEvent('open-settings'); window.dispatchEvent(ev); }} style={{ cursor: 'pointer' }}>Open settings</Badge>
        </Group>
        {owner && repo && (
          <>
            <Group gap="xs" wrap="wrap">
              <Badge variant="light" color="gray">{owner}/{repo}</Badge>
              <Badge variant="light">{loadingFiles ? 'Loading files…' : `${files.length} files`}</Badge>
            </Group>
            <Group gap="xs" wrap="wrap">
              {filteredFiles.map((p) => (
                <Button key={p} variant="subtle" onClick={() => onOpenPath(p)} title={p}>{p}</Button>
              ))}
            </Group>
            <Divider my="xs" />
          </>
        )}
        <Group gap="xs" wrap="wrap">
          {filteredPinned.map((r) => (
            <Button key={`${r.owner}/${r.repo}`} variant="light" onClick={() => onOpenRepo(r)}>
              {r.owner}/{r.repo}
            </Button>
          ))}
          {filteredRecent.map((f) => (
            <Button key={`${f.owner}/${f.repo}:${f.path}`} variant="subtle" onClick={() => onOpenFile(f)}>
              {f.owner}/{f.repo}:{f.path}
            </Button>
          ))}
          <Badge onClick={onTogglePreview} style={{ cursor: 'pointer' }} variant="light">Toggle preview</Badge>
        </Group>
      </Stack>
    </Modal>
  );
}


