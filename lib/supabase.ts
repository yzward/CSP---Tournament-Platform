import { createClient } from '@supabase/supabase-js';
import { createClient as createBrowserClient } from '@/utils/supabase/client';

let supabaseInstance: any = null;

export const getSupabase = () => {
  if (typeof window === 'undefined') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  if (supabaseInstance) return supabaseInstance;

  supabaseInstance = createBrowserClient();
  return supabaseInstance;
};

export const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  // Do NOT cache — always create fresh so env vars are read at call time (serverless safe)
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};
