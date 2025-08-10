import { useMemo } from 'react';
import type { EditorLanguage } from '@/shared/languages';

export function detectLanguage(path: string): EditorLanguage {
  const lower = (path || '').toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'javascript';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.xml')) return 'xml';
  if (lower.endsWith('.sql')) return 'sql';
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'yaml';
  if (lower.endsWith('.toml')) return 'toml';
  if (lower.endsWith('.php')) return 'php';
  if (lower.endsWith('.java')) return 'java';
  if (lower.endsWith('.go')) return 'go';
  if (lower.endsWith('.rs')) return 'rust';
  if (
    lower.endsWith('.c') || lower.endsWith('.h') || lower.endsWith('.cc') ||
    lower.endsWith('.cpp') || lower.endsWith('.cxx') || lower.endsWith('.hpp')
  ) return 'cpp';
  if (lower.endsWith('.scss') || lower.endsWith('.sass')) return 'sass';
  if (lower.endsWith('.sh') || lower.endsWith('.bash') || lower.endsWith('.zsh')) return 'shell';
  if (lower.endsWith('.rb')) return 'ruby';
  if (lower.endsWith('.pl')) return 'perl';
  if (lower.endsWith('.ini') || lower.endsWith('.cfg') || lower.endsWith('.conf')) return 'ini';
  if (lower.endsWith('nginx.conf')) return 'nginx';
  if (lower.endsWith('httpd.conf') || lower.includes('/apache2/') || lower.includes('apache')) return 'apache';
  if (lower.includes('dockerfile') || lower.endsWith('dockerfile')) return 'dockerfile';
  if (lower.endsWith('.ps1')) return 'powershell';
  return 'text';
}

export function useDetectedLanguage(path: string): EditorLanguage {
  return useMemo(() => detectLanguage(path), [path]);
}


