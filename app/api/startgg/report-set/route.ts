import { NextResponse } from 'next/server';
import { fetchStartGG, REPORT_SET_MUTATION } from '@/lib/startgg';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { matchId, winnerPlayerId, score } = await request.json();
    
    if (!matchId || !winnerPlayerId || !score) {
      return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Get match details (start.gg match ID)
    const { data: match, error: mError } = await supabase
      .from('matches')
      .select('*, tournaments(*)')
      .eq('id', matchId)
      .single();

    if (mError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const setId = match.evaroon_match_id;
    if (!setId) {
      return NextResponse.json({ error: 'Match is not linked to start.gg' }, { status: 400 });
    }

    // 2. Get winner's start.gg entrant ID
    const { data: entrant, error: eError } = await supabase
      .from('tournament_entrants')
      .select('startgg_entrant_id')
      .eq('tournament_id', match.tournament_id)
      .eq('player_id', winnerPlayerId)
      .single();

    if (eError || !entrant || !entrant.startgg_entrant_id) {
      return NextResponse.json({ error: 'Winner entrant ID not found on start.gg' }, { status: 404 });
    }

    // 3. Report to start.gg
    const syncResult = await fetchStartGG(REPORT_SET_MUTATION, {
      setId,
      winnerId: entrant.startgg_entrant_id,
      score
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Successfully reported result to start.gg',
      data: syncResult
    });

  } catch (error: any) {
    console.error('Start.gg Report Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to report result to start.gg' }, { status: 500 });
  }
}
