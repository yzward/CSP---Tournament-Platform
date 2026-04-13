import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function probeColumn(columnName) {
  const { error } = await supabase.from('tournaments').insert({ name: 'Test', [columnName]: null }).select();
  if (error && error.code === 'PGRST204') {
    return false; // Column does not exist
  }
  return true; // Column exists (RLS error means it passed schema validation)
}

async function main() {
  const possibleColumns = [
    'tournament_date', 'event_date', 'scheduled_date', 'time', 'datetime'
  ];
  
  const existingColumns = [];
  for (const col of possibleColumns) {
    const exists = await probeColumn(col);
    if (exists) {
      existingColumns.push(col);
    }
  }
  
  console.log('Existing columns:', existingColumns);
}

main();
