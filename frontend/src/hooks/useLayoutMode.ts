import { useMemo } from 'react';
import type { EditorLanguage } from '@/shared/languages';

export function useLayoutMode(showTree: boolean, showPreview: boolean, language: EditorLanguage): 'mode-tree' | 'mode-preview' | 'mode-editor-only' {
  return useMemo(() => {
    if (showTree) return 'mode-tree';
    if (showPreview && language === 'markdown') return 'mode-preview';
    return 'mode-editor-only';
  }, [showTree, showPreview, language]);
}


