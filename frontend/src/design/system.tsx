import React from 'react';
import { MantineProvider, createTheme, rem } from '@mantine/core';
import { Global } from '@emotion/react';

const fontStack = `Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu,
  Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"`;

export const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
  fontFamily: fontStack,
  headings: {
    fontFamily: fontStack,
    sizes: {
      h1: { fontSize: rem(28), lineHeight: '1.2', fontWeight: '700' },
      h2: { fontSize: rem(24), lineHeight: '1.25', fontWeight: '700' },
      h3: { fontSize: rem(20), lineHeight: '1.3', fontWeight: '700' },
      h4: { fontSize: rem(18), lineHeight: '1.35', fontWeight: '600' },
      h5: { fontSize: rem(16), lineHeight: '1.4', fontWeight: '600' },
      h6: { fontSize: rem(14), lineHeight: '1.4', fontWeight: '600' },
    },
  },
  fontSizes: {
    xs: rem(12),
    sm: rem(13),
    md: rem(14),
    lg: rem(16),
    xl: rem(18),
  },
  spacing: {
    xs: rem(6),
    sm: rem(10),
    md: rem(16),
    lg: rem(24),
    xl: rem(32),
  },
});

export function DesignSystemProvider({ children }: React.PropsWithChildren): JSX.Element {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Global
        styles={(t: any) => ({
          ':root': {
            // Dark palette
            '--bg': '#0b0c0f',
            '--panel': '#11131a',
            '--text': '#e6eaf2',
            '--muted': '#9aa3b2',
            '--border': '#1e2230',
            '--accent': '#4f8cff',
            '--accent-strong': '#2f6dff',
            '--danger': '#ff5c6c',
            '--success': '#28c17a',
            '--warning': '#f5a524',
            '--shadow': 'rgba(0,0,0,0.4)',
          },
          '@media (prefers-color-scheme: light)': {
            ':root': {
              '--bg': '#f8fafc',
              '--panel': '#ffffff',
              '--text': '#0d1421',
              '--muted': '#4b5565',
              '--border': '#e5e7eb',
              '--accent': '#3469ff',
              '--accent-strong': '#1f4de6',
              '--danger': '#d21f3c',
              '--success': '#149e66',
              '--warning': '#b97500',
              '--shadow': 'rgba(0,0,0,0.08)',
            },
          },
          'html, body, #root': { height: '100%' },
          body: {
            margin: 0,
            fontFamily: t.fontFamily,
            color: 'var(--text)',
            background: 'linear-gradient(180deg, var(--bg), #0b0d12 60%)',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          },
          p: { margin: `${t.spacing.xs} 0` },
          'h1, h2, h3, h4, h5, h6': {
            margin: `${t.spacing.sm} 0 ${t.spacing.xs}`,
            letterSpacing: '-0.01em',
          },
          a: { color: 'var(--accent)' },
          '::selection': { backgroundColor: 'rgba(79, 140, 255, 0.35)' },
          'code, pre': {
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          },
        })}
      />
      {children}
    </MantineProvider>
  );
}


