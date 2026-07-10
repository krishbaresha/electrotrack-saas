/**
 * ⚡ ABSOLUTE TOP-LEVEL CIRCUIT-BREAKER FOR MULTI-TENANT LOGOUT
 * 
 * This MUST execute before ANY module imports that read localStorage.
 * It runs synchronously at script parse-time, before Zustand store hydration,
 * before React imports, and before any global state initialization.
 * 
 * Purpose: Prevent race condition where subdomain logout redirects to main domain,
 * but the auth store has already hydrated stale tokens from localStorage during
 * module evaluation, causing immediate re-redirect to the tenant dashboard.
 */
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  if (params.has('logout') && params.get('logout') === 'true') {
    // 1. Clear all authentication data SYNCHRONOUSLY before any module can read it
    localStorage.removeItem('et-auth');
    localStorage.removeItem('auth-storage'); // Zustand default key pattern
    
    // 2. Also clear any namespaced auth keys that might exist
    const keysToRemove = Object.keys(localStorage).filter(key => 
      key.includes('auth') || key.includes('token') || key.includes('session')
    );
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // 3. Wipe session storage
    sessionStorage.clear();
    
    // 4. Clear all cookies (including wildcard domain cookies from subdomains)
    document.cookie.split(";").forEach((c) => {
      const cookieName = c.split("=")[0].trim();
      const domain = window.location.hostname;
      document.cookie = `${cookieName}=; max-age=0; path=/;`;
      // Also clear parent domain cookies
      if (domain.includes('.')) {
        const parentDomain = '.' + domain.split('.').slice(1).join('.');
        document.cookie = `${cookieName}=; max-age=0; path=/; domain=${parentDomain};`;
      }
    });
    
    // 5. CRITICAL: Strip logout flag from URL IMMEDIATELY
    // This prevents the circuit-breaker from re-triggering on refresh
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}

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
