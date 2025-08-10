import React, { RefObject } from 'react';
import { Modal, Stack, TextInput, Group, Button } from '@mantine/core';

type Props = {
  opened: boolean;
  onClose: () => void;
  commitMsg: string;
  setCommitMsg: (v: string) => void;
  onConfirm: () => void;
  loading: boolean;
  canConfirm: boolean;
  commitInputRef?: RefObject<HTMLInputElement>;
  pathForPlaceholder: string;
};

export function ConfirmSaveModal({ opened, onClose, commitMsg, setCommitMsg, onConfirm, loading, canConfirm, commitInputRef, pathForPlaceholder }: Props): JSX.Element {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Commit changes"
      trapFocus
      onEnterTransitionEnd={() => commitInputRef?.current?.focus()}
    >
      <Stack>
        <TextInput
          label="Commit message"
          id="commit"
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.currentTarget.value)}
          placeholder={`Update ${pathForPlaceholder || 'file'}`}
          ref={commitInputRef}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onConfirm();
            }
          }}
        />
        <Group justify="flex-end">
          <Button onClick={onClose} variant="subtle">Cancel</Button>
          <Button onClick={onConfirm} loading={loading} disabled={!canConfirm}>
            Commit
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}


