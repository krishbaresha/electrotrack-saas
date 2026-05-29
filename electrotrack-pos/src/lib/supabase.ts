import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,       // stores session in localStorage automatically
    autoRefreshToken: true,     // silently refreshes before expiry
    detectSessionInUrl: true,   // handles magic-link / OAuth redirects
    storageKey: 'et-session',   // namespaced key — avoids collisions
  },
});
