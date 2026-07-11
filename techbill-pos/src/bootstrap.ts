/**
 * ⚡ BOOTSTRAP - Global Initialization
 * 
 * This file MUST be imported at the absolute top of main.tsx
 * BEFORE any other imports, including React.
 * 
 * Purpose: Detect logout flag and clear storage BEFORE Zustand hydrates
 */

// Extend window to add our flag
declare global {
  interface Window {
    __APP_LOGOUT_DETECTED__: boolean;
  }
}

if (typeof window !== 'undefined') {
  // Check for logout flag in URL
  const params = new URLSearchParams(window.location.search);
  const hasLogoutFlag = params.get('logout') === 'true';
  
  // Set global flag that auth.store will check
  window.__APP_LOGOUT_DETECTED__ = hasLogoutFlag;
  
  if (hasLogoutFlag) {
    // 1. Clear all localStorage completely
    localStorage.clear();
    
    // 2. Clear sessionStorage
    sessionStorage.clear();
    
    // 3. Clear all cookies from current domain
    const clearCookie = (name: string) => {
      document.cookie = `${name}=; path=/; max-age=0`;
      document.cookie = `${name}=; path=/; domain=.${window.location.hostname}; max-age=0`;
      
      // Also clear from parent domain if this is a subdomain
      if (window.location.hostname.includes('.')) {
        const parentDomain = '.' + window.location.hostname.split('.').slice(1).join('.');
        document.cookie = `${name}=; path=/; domain=${parentDomain}; max-age=0`;
      }
    };
    
    // Clear all cookies
    document.cookie.split(';').forEach(c => {
      const cookieName = c.split('=')[0].trim();
      if (cookieName) clearCookie(cookieName);
    });
    
    // 4. Strip the logout flag from URL so page refreshes don't trigger it again
    const cleanUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}
