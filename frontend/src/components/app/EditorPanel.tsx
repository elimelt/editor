import React from 'react';
import { Paper, Stack, Group, Switch } from '@mantine/core';
import { CodeEditor } from '@/components/CodeEditor';
import type { EditorLanguage } from '@/shared/languages';

type Props = {
  open: boolean;
  fileName: string;
  language: EditorLanguage;
  value: string;
  onChange: (v: string) => void;
  showPreviewToggle: boolean;
  showPreview: boolean;
  onTogglePreview: (v: boolean) => void;
  wrapColumn?: number;
  onSaveClick: () => void;
  isSaving: boolean;
  canSave: boolean;
};

export function EditorPanel({ open, fileName, language, value, onChange, showPreviewToggle, showPreview, onTogglePreview, wrapColumn, onSaveClick, isSaving, canSave }: Props): JSX.Element | null {
  if (!open) return null;
  return (
    <Paper withBorder p="md" radius="md" className="editor-card">
      <Stack className="editor-stack">
        {!!fileName && (
          <Group justify="space-between" align="center" className="tree-header">
            <strong className="tree-title">{fileName}</strong>
            {showPreviewToggle && (
              <Switch checked={showPreview} onChange={(e) => onTogglePreview(e.currentTarget.checked)} label="Split preview" />
            )}
          </Group>
        )}
        <div className="editor-host">
          <CodeEditor
            value={value}
            onChange={onChange}
            language={language}
            softWrap={language === 'markdown' || language === 'text'}
            height={undefined as any}
            wrapColumn={wrapColumn}
          />
        </div>
        <Group>
          <button className="btn" onClick={onSaveClick} disabled={!canSave || isSaving}>
            {isSaving ? 'Saving…' : 'Save (Commit)'}
          </button>
        </Group>
      </Stack>
    </Paper>
  );
}


