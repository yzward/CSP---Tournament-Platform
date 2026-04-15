import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function probeColumn(tableName, columnName) {
  const { error } = await supabase.from(tableName).insert({ [columnName]: null }).select();
  if (error && error.code === 'PGRST204') {
    return false; // Column does not exist
  }
  return true; // Column exists
}

async function main() {
  const tables = {
    tournaments: ['format', 'stage1_format', 'stage2_format', 'held_at', 'date', 'challonge_id'],
    tournament_entrants: ['startgg_entrant_id', 'challonge_participant_id', 'status', 'placement'],
    matches: ['challonge_match_id', 'status', 'stage'],
    players: ['discord_id', 'username', 'display_name']
  };
  
  for (const [table, cols] of Object.entries(tables)) {
    const existing = [];
    for (const col of cols) {
      const exists = await probeColumn(table, col);
      if (exists) existing.push(col);
    }
    console.log(`${table}:`, existing);
  }
}

main();
