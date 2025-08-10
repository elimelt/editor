import React from 'react';
import { Drawer, Stack, SimpleGrid, TextInput, Group, Button } from '@mantine/core';

type Props = {
  opened: boolean;
  onClose: () => void;
  owner: string;
  setOwner: (v: string) => void;
  repo: string;
  setRepo: (v: string) => void;
  branch: string;
  setBranch: (v: string) => void;
  path: string;
  setPath: (v: string) => void;
  onOpenFile: () => void;
  canOpen: boolean;
};

export function SettingsDrawer({ opened, onClose, owner, setOwner, repo, setRepo, branch, setBranch, path, setPath, onOpenFile, canOpen }: Props): JSX.Element {
  return (
    <Drawer opened={opened} onClose={onClose} title="Repository & file" size="md" position="right" trapFocus>
      <Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Stack gap={6}>
            <TextInput label="Owner" id="owner" value={owner} onChange={(e) => setOwner(e.currentTarget.value)} placeholder="e.g. your-username" autoFocus />
            <TextInput label="Repo" id="repo" value={repo} onChange={(e) => setRepo(e.currentTarget.value)} placeholder="e.g. your-repo" />
          </Stack>
          <Stack gap={6}>
            <TextInput label="Branch" id="branch" value={branch} onChange={(e) => setBranch(e.currentTarget.value)} placeholder="e.g. main" />
            <TextInput label="Path" id="path" value={path} onChange={(e) => setPath(e.currentTarget.value)} placeholder="e.g. README.md" />
          </Stack>
        </SimpleGrid>
        <Group justify="space-between">
          <Button variant="subtle" onClick={onClose}>Close</Button>
          <Button onClick={onOpenFile} disabled={!canOpen}>Open file</Button>
        </Group>
      </Stack>
    </Drawer>
  );
}


