import { createClient } from '@supabase/supabase-js';
import { createClient as createBrowserClient } from '@/utils/supabase/client';

let supabaseInstance: any = null;
let supabaseAdminInstance: any = null;

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
  if (supabaseAdminInstance) return supabaseAdminInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';

  supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  return supabaseAdminInstance;
};
