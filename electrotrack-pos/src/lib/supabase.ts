import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[ElectroTrack] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. ' +
    'Direct Supabase cache sync will be disabled. ' +
    'Add both to your .env file to enable delta-sync caching.'
  );
}

/**
 * Global Supabase client instance.
 * Uses the anon key — safe to expose in the browser.
 * Only used for read-only delta-sync operations against
 * the products table, bypassing the Render NestJS layer.
 */
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Disable auth persistence — this client is read-only for cache sync only
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          'x-client-info': 'electrotrack-pos-cache/1.0',
        },
      },
    })
  : null;
