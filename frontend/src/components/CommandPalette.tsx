import React, { useEffect, useMemo, useState } from 'react';
import { Modal, TextInput, Group, Button, Stack, Badge } from '@mantine/core';
import { getRecentFiles, getPinnedRepos, PinnedRepo, RecentFile } from '@/shared/recent';

type Props = {
  opened: boolean;
  onClose: () => void;
  onOpenFile: (f: RecentFile) => void;
  onOpenRepo: (r: PinnedRepo) => void;
  onTogglePreview: () => void;
};

export function CommandPalette({ opened, onClose, onOpenFile, onOpenRepo, onTogglePreview }: Props) {
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<RecentFile[]>([]);
  const [pinned, setPinned] = useState<PinnedRepo[]>([]);

  useEffect(() => {
    if (opened) {
      setRecent(getRecentFiles());
      setPinned(getPinnedRepos());
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

  return (
    <Modal opened={opened} onClose={onClose} title="Command palette (Cmd/Ctrl+K)" size="lg">
      <Stack>
        <TextInput placeholder="Search recent files or pinned repos..." value={q} onChange={(e) => setQ(e.currentTarget.value)} autoFocus />
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


