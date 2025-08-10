import React from 'react';
import { MantineProvider, createTheme, rem } from '@mantine/core';
import { Global } from '@emotion/react';

const fontStack = `Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu,
  Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"`;

export const theme = createTheme({
  primaryColor: 'indigo',
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 'lg',
  fontFamily: fontStack,
  headings: {
    fontFamily: fontStack,
    sizes: {
      h1: { fontSize: rem(30), lineHeight: '1.15', fontWeight: '700' },
      h2: { fontSize: rem(26), lineHeight: '1.2', fontWeight: '700' },
      h3: { fontSize: rem(22), lineHeight: '1.25', fontWeight: '700' },
      h4: { fontSize: rem(18), lineHeight: '1.3', fontWeight: '600' },
      h5: { fontSize: rem(16), lineHeight: '1.35', fontWeight: '600' },
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
  shadows: {
    xs: '0 1px 2px rgba(0,0,0,0.18)',
    sm: '0 2px 8px rgba(0,0,0,0.22)',
    md: '0 8px 24px rgba(0,0,0,0.28)',
    lg: '0 16px 40px rgba(0,0,0,0.34)'
  },
});

export function DesignSystemProvider({ children }: React.PropsWithChildren): JSX.Element {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Global
        styles={{
          ':root': {
            // Dark palette
            '--bg': '#0a0b0e',
            '--panel': '#0f1117',
            '--panel-a': 'rgba(255,255,255,0.04)',
            '--text': '#e8ecf5',
            '--muted': '#9aa3b2',
            '--border': '#1a1f2b',
            '--accent': '#6aa8ff',
            '--accent-strong': '#3b7dff',
            '--danger': '#ff5c6c',
            '--success': '#28c17a',
            '--warning': '#f5a524',
            '--shadow': 'rgba(0,0,0,0.45)',
            '--focus': 'rgba(106,168,255,0.45)'
          },
          '@media (prefers-color-scheme: light)': {
            ':root': {
              '--bg': '#f6f7fb',
              '--panel': '#ffffff',
              '--panel-a': 'rgba(255,255,255,0.75)',
              '--text': '#0d1220',
              '--muted': '#4b5565',
              '--border': '#e6e9f2',
              '--accent': '#3d76ff',
              '--accent-strong': '#1f56f0',
              '--danger': '#d21f3c',
              '--success': '#149e66',
              '--warning': '#b97500',
              '--shadow': 'rgba(0,0,0,0.08)',
              '--focus': 'rgba(61,118,255,0.35)'
            },
          },
          'html, body, #root': { height: '100%' },
          body: {
            margin: 0,
            fontFamily: theme.fontFamily,
            color: 'var(--text)',
            background:
              'radial-gradient(1200px 600px at 20% -10%, rgba(106,168,255,0.08), transparent 60%),\
               radial-gradient(1200px 600px at 80% -10%, rgba(158,108,255,0.06), transparent 60%),\
               linear-gradient(180deg, var(--bg), #0b0d12 60%)',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          },
          p: { margin: `${rem(6)} 0` },
          'h1, h2, h3, h4, h5, h6': {
            margin: `${rem(10)} 0 ${rem(6)}`,
            letterSpacing: '-0.015em',
          },
          a: { color: 'var(--accent)' },
          '::selection': { backgroundColor: 'rgba(106,168,255,0.28)' },
          'code, pre': {
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          },

          // Glass panels / cards
          '.mantine-Paper-root': {
            backgroundColor: 'var(--panel-a)',
            borderColor: 'var(--border)',
            boxShadow: '0 8px 30px var(--shadow)',
            WebkitBackdropFilter: 'saturate(120%) blur(12px)',
            backdropFilter: 'saturate(120%) blur(12px)',
            transition: 'border-color 120ms ease, box-shadow 180ms ease, transform 120ms ease',
          },
          '.mantine-Paper-root:hover': {
            boxShadow: '0 12px 40px var(--shadow)',
          },

          // Buttons
          '.mantine-Button-root': {
            borderRadius: rem(12),
            fontWeight: 600,
            letterSpacing: '-0.01em',
            transition: 'transform 80ms ease, box-shadow 120ms ease',
          },
          '.mantine-Button-root:active': { transform: 'translateY(1px)' },

          // Inputs
          '.mantine-TextInput-input, .mantine-Textarea-input, .mantine-PasswordInput-input': {
            borderRadius: rem(12),
            backgroundColor: 'transparent',
            transition: 'border-color 120ms ease, box-shadow 120ms ease',
          },
          '.mantine-TextInput-input:focus, .mantine-Textarea-input:focus, .mantine-PasswordInput-input:focus': {
            outline: 'none',
            boxShadow: `0 0 0 3px var(--focus)`,
            borderColor: 'var(--accent)'
          },

          // Scrollbars
          '*::-webkit-scrollbar': { width: rem(10), height: rem(10) },
          '*::-webkit-scrollbar-thumb': {
            background: 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))',
            borderRadius: rem(10),
            border: '2px solid transparent',
            backgroundClip: 'padding-box',
          },
          '*::-webkit-scrollbar-track': { background: 'transparent' },
        }}
      />
      {children}
    </MantineProvider>
  );
}


