import { useEffect } from 'react';
import type { EditorLanguage } from '@/shared/languages';

export function usePreviewGuards(openState: 'idle' | 'loading' | 'loaded' | 'error', language: EditorLanguage, setShowPreview: (v: boolean) => void): void {
  // Keep preview state consistent with file type and load state
  useEffect(() => {
    if (!(openState === 'loaded' && language === 'markdown')) setShowPreview(false);
  }, [openState, language, setShowPreview]);
}


