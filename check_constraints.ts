import { getSupabaseAdmin } from './lib/supabase';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function run() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('tournaments').insert({
    name: 'Test',
    held_at: '2024-01-01',
    format: 'single_elim',
    status: 'active'
  });
  console.log('single_elim:', error);

  const { error: e2 } = await supabase.from('tournaments').insert({
    name: 'Test',
    held_at: '2024-01-01',
    format: 'single elimination',
    status: 'active'
  });
  console.log('single elimination:', e2);
}
run();
