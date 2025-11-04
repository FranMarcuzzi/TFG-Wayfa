import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kckgusvefbatakzfmviy.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtja2d1c3ZlZmJhdGFremZtdml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNTkzNDMsImV4cCI6MjA3NzgzNTM0M30.UVp1u2l3v6udf1SdBrBTj6OJsggs9LdMl0_Tj5CLmCo';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
