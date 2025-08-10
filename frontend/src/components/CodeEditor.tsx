import React, { useEffect, useMemo, useRef } from 'react';
import { EditorState, Extension, Compartment } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine, highlightSpecialChars, drawSelection, rectangularSelection, crosshairCursor, lineNumbers } from '@codemirror/view';
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput } from '@codemirror/language';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

type Props = {
  value: string;
  onChange: (next: string) => void;
  language: 'markdown' | 'javascript' | 'typescript' | 'html' | 'css' | 'json' | 'python' | 'text';
  readOnly?: boolean;
  softWrap?: boolean;
};

export function CodeEditor({ value, onChange, language, readOnly = false, softWrap = false }: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const langExt = useMemo<Extension>(() => {
    switch (language) {
      case 'markdown':
        return markdown({ base: markdownLanguage });
      case 'javascript':
      case 'typescript':
        return javascript({ typescript: language === 'typescript' });
      case 'html':
        return html();
      case 'css':
        return css();
      case 'json':
        return json();
      case 'python':
        return python();
      default:
        return [];
    }
  }, [language]);

  const baseExtensions = useMemo<Extension[]>(() => [
    lineNumbers(),
    highlightActiveLine(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    rectangularSelection(),
    crosshairCursor(),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    autocompletion(),
    highlightSelectionMatches(),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...completionKeymap,
      ...lintKeymap,
    ]),
    oneDark,
  ], []);

  useEffect(() => {
    if (!hostRef.current) return;
    const languageCompartment = new Compartment();
    const flagsCompartment = new Compartment();
    const updateListener = EditorView.updateListener.of((v) => {
      if (v.docChanged) {
        onChange(v.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        baseExtensions,
        languageCompartment.of(langExt),
        flagsCompartment.of([
          readOnly ? EditorState.readOnly.of(true) : [],
          softWrap ? EditorView.lineWrapping : [],
        ]),
        updateListener,
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    // Store compartments on the view instance for reconfiguration
    (view as any)._languageCompartment = languageCompartment;
    (view as any)._flagsCompartment = flagsCompartment;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostRef]);

  // Update language/flags
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const languageCompartment: Compartment | undefined = (view as any)._languageCompartment;
    const flagsCompartment: Compartment | undefined = (view as any)._flagsCompartment;
    const effects: any[] = [];
    if (languageCompartment) effects.push(languageCompartment.reconfigure(langExt));
    if (flagsCompartment) effects.push(flagsCompartment.reconfigure([
      readOnly ? EditorState.readOnly.of(true) : [],
      softWrap ? EditorView.lineWrapping : [],
    ]));
    if (effects.length) view.dispatch({ effects });
  }, [langExt, baseExtensions, readOnly, softWrap]);

  // External value updates
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  return (
    <div
      style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', minHeight: 360 }}
      ref={hostRef}
    />
  );
}


