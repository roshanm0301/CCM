/**
 * CCM PWA entry point.
 * Mounts the React application into the #root DOM element.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Root element with id="root" not found. Check index.html.',
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
