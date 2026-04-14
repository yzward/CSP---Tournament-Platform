import { getSupabaseAdmin } from './lib/supabase';

async function run() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('run_sql', { query: "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'tournaments_format_check';" });
  console.log(data, error);
}
run();
