import { useEffect, useState } from 'react';

export function useModifierAndEditorFocus(): { modifierHeld: boolean; focusInEditor: boolean } {
  const [modifierHeld, setModifierHeld] = useState(false);
  const [focusInEditor, setFocusInEditor] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') setModifierHeld(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') setModifierHeld(false);
      if (!e.ctrlKey && !e.metaKey) setModifierHeld(false);
    };
    const handleFocusChange = () => {
      const active = document.activeElement as HTMLElement | null;
      const inEditor = Boolean(active?.closest('.cm-editor'));
      setFocusInEditor(inEditor);
    };
    window.addEventListener('keydown', handleKeyDown, { passive: true });
    window.addEventListener('keyup', handleKeyUp, { passive: true });
    document.addEventListener('focusin', handleFocusChange, { passive: true });
    document.addEventListener('focusout', handleFocusChange, { passive: true });
    handleFocusChange();
    return () => {
      window.removeEventListener('keydown', handleKeyDown as any);
      window.removeEventListener('keyup', handleKeyUp as any);
      document.removeEventListener('focusin', handleFocusChange as any);
      document.removeEventListener('focusout', handleFocusChange as any);
    };
  }, []);

  return { modifierHeld, focusInEditor };
}


