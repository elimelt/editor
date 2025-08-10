import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './shared/ErrorBoundary';
import './index.css';
import 'highlight.js/styles/github-dark.css';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { Notifications } from '@mantine/notifications';
import { DesignSystemProvider } from './design/system';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing root element');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <DesignSystemProvider>
      <Notifications position="top-right" limit={3} />
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </DesignSystemProvider>
  </React.StrictMode>
);


