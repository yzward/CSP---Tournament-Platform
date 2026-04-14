import { getSupabaseAdmin } from './lib/supabase';

async function run() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('tournaments').select('*').limit(1);
  console.log(data, error);
}
run();
