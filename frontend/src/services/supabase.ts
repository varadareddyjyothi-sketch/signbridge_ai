/**
 * SignBridge AI - Frontend Supabase Client
 * Optional client-side integration for Supabase Auth and User sessions.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

let client: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
  try {
    client = createClient(supabaseUrl, supabaseKey);
    console.log('[SignBridge] Supabase client initialized.');
  } catch (err) {
    console.warn('[SignBridge] Failed to initialize Supabase client:', err);
    client = null;
  }
}

export const supabase = client;
export const isSupabaseClientConfigured = (): boolean => client !== null;
