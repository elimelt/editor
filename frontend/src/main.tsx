import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './shared/ErrorBoundary';
import './index.css';
import 'highlight.js/styles/github-dark.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing root element');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);


