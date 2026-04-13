import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('tournaments').insert({ name: 'Test', start_date: '2026-04-12' }).select();
  console.log('Error:', error);
  console.log('Data:', data);
}
test();
