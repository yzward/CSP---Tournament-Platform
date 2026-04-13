import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('tournaments').select('*').limit(1);
  if (error) console.error(error);
  if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  } else {
    console.log('No data found, trying to insert an empty row to see the error...');
    const { error: insertError } = await supabase.from('tournaments').insert({}).select();
    console.log(insertError);
  }
}
test();
