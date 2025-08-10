import React, { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

type Props = {
  markdown: string;
};

export function MarkdownPreview({ markdown }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const html = useMemo(() => {
    marked.setOptions({
      gfm: true,
      breaks: false,
    } as any);
    const raw = marked.parse(markdown);
    const clean = DOMPurify.sanitize(typeof raw === 'string' ? raw : '');
    return clean;
  }, [markdown]);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.querySelectorAll('pre code').forEach((el) => {
      try { hljs.highlightElement(el as HTMLElement); } catch {}
    });
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="md-preview"
      dangerouslySetInnerHTML={{ __html: html }}
      aria-label="Markdown preview"
    />
  );
}


