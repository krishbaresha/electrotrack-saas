/**
 * ⚡ CRITICAL: Bootstrap MUST be imported first, before anything else
 */
import './bootstrap';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { api } from './api/client';
import { processPendingSales } from './db/offline.db';
import ErrorBoundary from './components/common/ErrorBoundary';

function syncOfflineSales() {
  processPendingSales((payload) => api.post('/sales', payload)).catch(() => {});
}

window.addEventListener('online', syncOfflineSales);
window.addEventListener('focus', syncOfflineSales);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
