import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  console.log('DEBUG-DB ROUTE REACHED');
  const supabase = getSupabaseAdmin();
  
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const keysMatch = anonKey === serviceKey;

  // Try to insert a test tournament to check RLS and constraints
  const { data: insertData, error: insertError } = await supabase
    .from('tournaments')
    .insert({
      name: 'DEBUG TEST ' + new Date().toISOString(),
      held_at: new Date().toISOString().split('T')[0],
      format: 'swiss', // Legacy column but still NOT NULL
      stage1_format: 'swiss',
      status: 'active',
      is_ranking_tournament: true,
      stage_type: 'single'
    })
    .select()
    .single();

  const { data: tournaments, error: selectError } = await supabase.from('tournaments').select('*').limit(10);

  return NextResponse.json({ 
    diagnostics: {
      anonKeySet: !!anonKey,
      serviceKeySet: !!serviceKey,
      keysMatch, // If true, getSupabaseAdmin() will NOT bypass RLS
      anonKeyPrefix: anonKey?.substring(0, 10),
      serviceKeyPrefix: serviceKey?.substring(0, 10),
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
    },
    insert: { data: insertData, error: insertError },
    select: { data: tournaments, error: selectError }
  });
}
