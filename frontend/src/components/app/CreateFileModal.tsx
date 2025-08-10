import React from 'react';
import { Modal, Stack, TextInput, Group, Button } from '@mantine/core';

type Props = {
  opened: boolean;
  onClose: () => void;
  newPath: string;
  setNewPath: (v: string) => void;
  onCreate: () => void;
  canCreate: boolean;
};

export function CreateFileModal({ opened, onClose, newPath, setNewPath, onCreate, canCreate }: Props): JSX.Element {
  return (
    <Modal opened={opened} onClose={onClose} title="Create new file" trapFocus>
      <Stack>
        <TextInput label="Path" placeholder="e.g. docs/README.md" value={newPath} onChange={(e) => setNewPath(e.currentTarget.value)} autoFocus />
        <Group justify="flex-end">
          <Button onClick={onClose} variant="subtle">Cancel</Button>
          <Button onClick={onCreate} disabled={!canCreate}>Create</Button>
        </Group>
      </Stack>
    </Modal>
  );
}


