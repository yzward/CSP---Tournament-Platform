import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tournamentId = url.searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const apiKey = process.env.CHALLONGE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'No CHALLONGE_API_KEY' }, { status: 500 });

  // Get local tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('challonge_id')
    .eq('id', tournamentId)
    .single();

  if (!tournament?.challonge_id) return NextResponse.json({ error: 'No challonge_id on tournament' }, { status: 404 });

  // Get entrant map from DB
  const { data: entrants } = await supabase
    .from('tournament_entrants')
    .select('player_id, startgg_entrant_id')
    .eq('tournament_id', tournamentId)
    .not('startgg_entrant_id', 'is', null);

  const entrantMap: Record<string, string> = {};
  (entrants || []).forEach(e => { entrantMap[e.startgg_entrant_id!.toString()] = e.player_id; });

  // Fetch matches from Challonge
  const challongeRes = await fetch(
    `https://api.challonge.com/v1/tournaments/${tournament.challonge_id}.json?include_matches=1&api_key=${apiKey}`
  );
  const raw = await challongeRes.json();

  if (!challongeRes.ok) return NextResponse.json({ error: 'Challonge error', detail: raw }, { status: 502 });

  const matches = (raw.tournament?.matches || []).map((m: any) => m.match).map((m: any) => ({
    challonge_match_id: m.id,
    state: m.state,
    player1_id: m.player1_id,
    player2_id: m.player2_id,
    player1_resolved: m.player1_id ? entrantMap[m.player1_id.toString()] ?? 'NOT IN MAP' : null,
    player2_resolved: m.player2_id ? entrantMap[m.player2_id.toString()] ?? 'NOT IN MAP' : null,
  }));

  return NextResponse.json({
    challonge_id: tournament.challonge_id,
    entrantMap_size: Object.keys(entrantMap).length,
    entrantMap_keys: Object.keys(entrantMap),
    matches,
  });
}
