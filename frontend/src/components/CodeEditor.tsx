import React, { useEffect, useMemo, useRef } from 'react';
import { EditorState, Extension, Compartment } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine, highlightSpecialChars, drawSelection, rectangularSelection, crosshairCursor, lineNumbers } from '@codemirror/view';
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput } from '@codemirror/language';
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { xml } from '@codemirror/lang-xml';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';
// No official @codemirror/lang-toml; use legacy stream mode via ini for basic highlighting
import { php } from '@codemirror/lang-php';
import { java } from '@codemirror/lang-java';
import { go } from '@codemirror/lang-go';
import { rust } from '@codemirror/lang-rust';
import { cpp } from '@codemirror/lang-cpp';
import { sass } from '@codemirror/lang-sass';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { perl } from '@codemirror/legacy-modes/mode/perl';
import { toml as tomlLegacy } from '@codemirror/legacy-modes/mode/toml';
import { nginx } from '@codemirror/legacy-modes/mode/nginx';
import { http } from '@codemirror/legacy-modes/mode/http';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';
import { oneDark } from '@codemirror/theme-one-dark';

type Props = {
  value: string;
  onChange: (next: string) => void;
  language:
    | 'markdown' | 'javascript' | 'typescript' | 'html' | 'css' | 'json' | 'python' | 'xml' | 'sql'
    | 'yaml' | 'toml' | 'php' | 'java' | 'go' | 'rust' | 'cpp' | 'sass' | 'shell' | 'ruby' | 'perl'
    | 'ini' | 'nginx' | 'apache' | 'dockerfile' | 'powershell' | 'text';
  readOnly?: boolean;
  softWrap?: boolean;
  height?: number | string | undefined;
  wrapColumn?: number; // max characters per line when wrapping (softWrap)
};

export function CodeEditor({ value, onChange, language, readOnly = false, softWrap = false, height = '70vh', wrapColumn = 96 }: Props): JSX.Element {
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
      case 'xml':
        return xml();
      case 'sql':
        return sql();
      case 'yaml':
        return yaml();
      case 'toml':
        return StreamLanguage.define(tomlLegacy);
      case 'php':
        return php();
      case 'java':
        return java();
      case 'go':
        return go();
      case 'rust':
        return rust();
      case 'cpp':
        return cpp();
      case 'sass':
        return sass();
      case 'shell':
        return StreamLanguage.define(shell);
      case 'ruby':
        return StreamLanguage.define(ruby);
      case 'perl':
        return StreamLanguage.define(perl);
      case 'nginx':
        return StreamLanguage.define(nginx);
      case 'apache':
        return StreamLanguage.define(http);
      case 'dockerfile':
        return StreamLanguage.define(dockerFile);
      case 'powershell':
        return StreamLanguage.define(powerShell);
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
      indentWithTab,
    ]),
    oneDark,
  ], []);

  useEffect(() => {
    if (!hostRef.current) return;
    const languageCompartment = new Compartment();
    const flagsCompartment = new Compartment();
    const themeCompartment = new Compartment();
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
        themeCompartment.of(themeExtension),
        updateListener,
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    // Store compartments on the view instance for reconfiguration
    (view as any)._languageCompartment = languageCompartment;
    (view as any)._flagsCompartment = flagsCompartment;
    (view as any)._themeCompartment = themeCompartment;
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

  // Editor theme to constrain height and optional wrap column for soft wrap
  const themeExtension = useMemo<Extension>(() => EditorView.theme({
    '&': {
      height: height == null ? '100%' : (typeof height === 'number' ? `${height}px` : String(height)),
      border: '1px solid var(--border)',
      borderRadius: '8px',
    },
    '.cm-scroller': {
      overflow: 'auto',
      height: '100%',
      WebkitOverflowScrolling: 'touch',
    },
    '.cm-content': softWrap ? {
      maxWidth: `${wrapColumn}ch`,
      margin: '0 auto',
    } : {},
  }), [height, softWrap, wrapColumn]);

  // Attach theme extension
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const themeCompartment: Compartment | undefined = (view as any)._themeCompartment;
    if (!themeCompartment) return;
    view.dispatch({ effects: themeCompartment.reconfigure(themeExtension) });
  }, [themeExtension]);

  return <div ref={hostRef} />;
}


