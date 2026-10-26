import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration keys for localStorage
const STORAGE_URL_KEY = 'duoxo_supabase_url';
const STORAGE_ANON_KEY = 'duoxo_supabase_anon_key';

export function getSupabaseCredentials(): { url: string; anonKey: string; isConfigured: boolean; source: 'env' | 'storage' | 'none' } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (envUrl && envAnonKey && envUrl !== 'https://your-project-id.supabase.co') {
    return { url: envUrl, anonKey: envAnonKey, isConfigured: true, source: 'env' };
  }

  if (typeof window !== 'undefined') {
    const storedUrl = (localStorage.getItem(STORAGE_URL_KEY) || '').trim();
    const storedAnonKey = (localStorage.getItem(STORAGE_ANON_KEY) || '').trim();

    if (storedUrl && storedAnonKey) {
      return { url: storedUrl, anonKey: storedAnonKey, isConfigured: true, source: 'storage' };
    }
  }

  return { url: '', anonKey: '', isConfigured: false, source: 'none' };
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_URL_KEY, url.trim());
    localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
    // Invalidate client instance
    cachedClient = null;
  }
}

export function clearSupabaseCredentials(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_URL_KEY);
    localStorage.removeItem(STORAGE_ANON_KEY);
    cachedClient = null;
  }
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseCredentials();
  if (!isConfigured) {
    return null;
  }

  if (!cachedClient) {
    try {
      cachedClient = createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        realtime: {
          params: {
            eventsPerSecond: 20,
          },
        },
      });
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return cachedClient;
}
