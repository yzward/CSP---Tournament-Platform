import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseTournamentId } from '@/lib/challonge';

// Re-open a completed Challonge match so scores can be re-entered.
// Equivalent to V3's reopenMatch() — useful when a result was entered incorrectly.

export async function POST(req: Request) {
  try {
    const { matchId } = await req.json();
    if (!matchId) return NextResponse.json({ error: 'Missing match ID' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // Load match + tournament
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*, tournaments(*)')
      .eq('id', matchId)
      .single();

    if (matchError || !match) throw new Error('Match not found');
    if (!match.challonge_match_id) throw new Error('Match is not linked to Challonge');
    if (!match.tournaments?.challonge_id) throw new Error('Tournament is not linked to Challonge');

    const apiKey = process.env.CHALLONGE_API_KEY;
    if (!apiKey) throw new Error('CHALLONGE_API_KEY is not configured');

    const { id: challongeTournamentId } = parseTournamentId(match.tournaments.challonge_id);
    const challongeMatchId = match.challonge_match_id;

    // Call Challonge reopen endpoint
    const response = await fetch(
      `https://api.challonge.com/v1/tournaments/${challongeTournamentId}/matches/${challongeMatchId}/reopen.json?api_key=${apiKey}`,
      { method: 'POST' }
    );

    const result = await response.json();

    if (!response.ok) {
      const errMsg = result?.errors?.join(', ') || result?.error || `Challonge returned ${response.status}`;
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    // Reset local match status back to pending so scorers can re-enter
    await supabase
      .from('matches')
      .update({ status: 'pending', winner_id: null })
      .eq('id', matchId);

    return NextResponse.json({ success: true, message: 'Match reopened — scores cleared for re-entry' });

  } catch (error: any) {
    console.error('[Reopen Match] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to reopen match' }, { status: 500 });
  }
}
