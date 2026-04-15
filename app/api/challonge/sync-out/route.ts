import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseTournamentId } from '@/lib/challonge';

export async function POST(req: Request) {
  try {
    const { tournamentId } = await req.json();
    if (!tournamentId) {
      return NextResponse.json({ error: 'Missing tournament ID' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Get tournament from local DB
    const { data: tournament, error: tError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (!tournament.evaroon_id) {
      return NextResponse.json({ error: 'Tournament is not linked to Challonge' }, { status: 400 });
    }

    const { id: challongeId } = parseTournamentId(tournament.evaroon_id);
    const apiKey = process.env.CHALLONGE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'CHALLONGE_API_KEY is missing' }, { status: 500 });
    }

    // 2. Get local entrants who are NOT synced yet
    const { data: entrants, error: eError } = await supabase
      .from('tournament_entrants')
      .select('*, players(display_name)')
      .eq('tournament_id', tournamentId)
      .is('startgg_entrant_id', null);

    if (eError) throw eError;
    if (!entrants || entrants.length === 0) {
      return NextResponse.json({ success: true, message: 'All entrants are already synced' });
    }

    // 3. Push to Challonge
    // We'll use bulk_add if possible, but Challonge's bulk_add is a bit picky.
    // Let's do them one by one for reliability, or use bulk_add if we have many.
    
    let syncedCount = 0;
    for (const entrant of entrants) {
      const name = (entrant.players as any)?.display_name || 'Unknown Player';
      
      const response = await fetch(`https://api.challonge.com/v1/tournaments/${challongeId}/participants.json?api_key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant: {
            name: name
          }
        })
      });

      const result = await response.json();
      if (response.ok && result.participant) {
        // Update local DB with Challonge ID
        await supabase
          .from('tournament_entrants')
          .update({ startgg_entrant_id: result.participant.id.toString() })
          .eq('id', entrant.id);
        syncedCount++;
      } else {
        console.error(`Failed to sync participant ${name}:`, result);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully synced ${syncedCount} new entrants to Challonge` 
    });

  } catch (error: any) {
    console.error('Challonge Sync Out Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync out' }, { status: 500 });
  }
}
