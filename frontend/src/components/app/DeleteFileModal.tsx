import React from 'react';
import { Modal, Stack, Group, Button } from '@mantine/core';

type Props = {
  opened: boolean;
  filePath: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
};

export function DeleteFileModal({ opened, filePath, onCancel, onConfirm, loading }: Props): JSX.Element {
  return (
    <Modal opened={opened} onClose={onCancel} title="Delete file?" withCloseButton={false}>
      <Stack>
        <div>Are you sure you want to delete <strong>{filePath}</strong>? This cannot be undone.</div>
        <Group justify="flex-end">
          <Button onClick={onCancel} variant="subtle">Cancel</Button>
          <Button color="red" loading={loading} onClick={onConfirm}>Delete</Button>
        </Group>
      </Stack>
    </Modal>
  );
}


