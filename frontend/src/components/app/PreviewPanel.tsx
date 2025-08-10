import React from 'react';
import { Paper, ScrollArea } from '@mantine/core';
import { MarkdownPreview } from '@/components/MarkdownPreview';

type Props = {
  open: boolean;
  markdown: string;
};

export function PreviewPanel({ open, markdown }: Props): JSX.Element | null {
  if (!open) return null;
  return (
    <Paper withBorder p="md" radius="md" className="preview-card">
      <ScrollArea className="preview-scroll" type="auto">
        <MarkdownPreview markdown={markdown} />
      </ScrollArea>
    </Paper>
  );
}


