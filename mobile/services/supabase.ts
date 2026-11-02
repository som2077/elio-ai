import { createClient } from '@supabase/supabase-js';

// Direct production credentials to guarantee mobile connectivity even without process.env in bundling
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://ooldsqkuxwvznnypumxd.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbGRzcWt1eHd2em5ueXB1bXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODQxMjcsImV4cCI6MjEwNjk2MDEyN30.BTk4_b98cJld5KBftoSvISE3u9qeoid6U7ynWMfArTo';

export const isSupabaseConfigured = true;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
