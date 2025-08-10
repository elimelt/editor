import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './shared/ErrorBoundary';
import './index.css';
import 'highlight.js/styles/github-dark.css';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing root element');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <MantineProvider theme={createTheme({ primaryColor: 'blue', defaultRadius: 'md' })} defaultColorScheme="dark">
      <Notifications position="top-right" limit={3} />
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </MantineProvider>
  </React.StrictMode>
);


