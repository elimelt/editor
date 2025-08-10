import React from 'react';
import { Group, Button, TextInput, Badge, Divider } from '@mantine/core';

export type RepoItem = { owner: string; name: string; fullName: string; defaultBranch: string; desc?: string | null };

type Props = {
  userLogin?: string | null;
  repos: RepoItem[];
  repoQuery: string;
  setRepoQuery: (v: string) => void;
  onSelectRepo: (r: RepoItem) => void;
  onLoadPins: () => void;
};

export function RepoPicker({ userLogin, repos, repoQuery, setRepoQuery, onSelectRepo, onLoadPins }: Props): JSX.Element | null {
  if (!userLogin) return null;
  const filtered = repos.filter((r) => {
    const q = repoQuery.trim().toLowerCase();
    if (!q) return true;
    return r.fullName.toLowerCase().includes(q) || (r.desc ? r.desc.toLowerCase().includes(q) : false);
  }).slice(0, 10);

  return (
    <>
      <Group justify="space-between" align="center">
        <Group>
          <strong>Your repos</strong>
          <Button variant="subtle" onClick={onLoadPins}>Load pins</Button>
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
        {filtered.map((r) => (
          <Group key={r.fullName} gap={4} wrap="nowrap">
            <Button
              variant="light"
              role="listitem"
              onClick={() => onSelectRepo(r)}
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
  );
}


