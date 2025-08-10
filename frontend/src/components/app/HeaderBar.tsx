import React from 'react';
import { Paper, Group, Button, Title, Badge } from '@mantine/core';

type Props = {
  canToggleFiles: boolean;
  showTree: boolean;
  onToggleFiles: () => void;
  userLogin: string | null;
  onLogin: () => void;
  onLogout: () => void;
  onOpenPalette: () => void;
  onOpenSettings: () => void;
};

export function HeaderBar({ canToggleFiles, showTree, onToggleFiles, userLogin, onLogin, onLogout, onOpenPalette, onOpenSettings }: Props): JSX.Element {
  return (
    <Paper withBorder p="md" radius="md" className="header">
      <Group justify="space-between" wrap="wrap">
        <Group gap="sm">
          <Title order={2}>GitHub Editor</Title>
          {canToggleFiles && (
            <Button variant="light" onClick={onToggleFiles} title="Toggle file tree (Cmd/Ctrl+B)">
              {showTree ? 'Hide files' : 'Show files'}
            </Button>
          )}
        </Group>
        <Group>
          <Button variant="light" onClick={onOpenPalette} title="Command palette (Cmd/Ctrl+K or Cmd/Ctrl+P)">Command palette</Button>
          <Button variant="subtle" onClick={onOpenSettings} title="Settings (Cmd/Ctrl+,)" disabled={!userLogin}>Settings</Button>
          {userLogin ? (
            <>
              <Badge variant="light" color="gray">{userLogin}</Badge>
              <Button variant="subtle" onClick={onLogout} title="Clear token">Logout</Button>
            </>
          ) : (
            <Button onClick={onLogin}>Login with GitHub</Button>
          )}
        </Group>
      </Group>
    </Paper>
  );
}


