import { useEffect } from 'react';

type Options = {
  onSave: () => void;
  onOpenPalette: () => void;
  onTogglePreview: () => void;
  onToggleFiles: () => void;
  onOpenSettings: () => void;
  isMarkdownPreviewAvailable: boolean;
};

export function useGlobalShortcuts({ onSave, onOpenPalette, onTogglePreview, onToggleFiles, onOpenSettings, isMarkdownPreviewAvailable }: Options): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        onSave();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        onOpenPalette();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        onOpenPalette();
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        if (isMarkdownPreviewAvailable) onTogglePreview();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        if (isMarkdownPreviewAvailable) onTogglePreview();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        onToggleFiles();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        onOpenSettings();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSave, onOpenPalette, onTogglePreview, onToggleFiles, onOpenSettings, isMarkdownPreviewAvailable]);
}


