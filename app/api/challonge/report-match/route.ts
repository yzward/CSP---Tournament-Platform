import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseTournamentId } from '@/lib/challonge';

export async function POST(req: Request) {
  try {
    const { matchId } = await req.json();
    if (!matchId) return NextResponse.json({ error: 'Missing match ID' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // 1. Get match details
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*, tournaments(*)')
      .eq('id', matchId)
      .single();

    if (matchError || !match) throw new Error('Match not found');
    if (!match.evaroon_match_id) throw new Error('Match not linked to Challonge');
    if (!match.tournaments?.evaroon_id) throw new Error('Tournament not linked to Challonge');

    const { id: challongeTournamentId } = parseTournamentId(match.tournaments.evaroon_id);
    const challongeMatchId = match.evaroon_match_id;

    // 2. Get match players
    const { data: matchPlayers, error: mpError } = await supabase
      .from('match_players')
      .select('*, players(*)')
      .eq('match_id', matchId);

    if (mpError || !matchPlayers || matchPlayers.length !== 2) {
      throw new Error('Could not fetch match players');
    }

    // Get entrants to find Challonge participant IDs
    const { data: entrants, error: entrantsError } = await supabase
      .from('tournament_entrants')
      .select('player_id, startgg_entrant_id')
      .eq('tournament_id', match.tournament_id)
      .in('player_id', matchPlayers.map(mp => mp.player_id));

    if (entrantsError || !entrants || entrants.length !== 2) {
      throw new Error('Could not fetch tournament entrants');
    }

    const p1 = matchPlayers[0];
    const p2 = matchPlayers[1];
    
    const p1Entrant = entrants.find(e => e.player_id === p1.player_id);
    const p2Entrant = entrants.find(e => e.player_id === p2.player_id);

    // 3. Format score for Challonge (e.g., "3-1")
    // Challonge expects scores from the perspective of the winner or just player1-player2
    // Let's use player1_score-player2_score
    const scoreCsv = `${p1.sets_won}-${p2.sets_won}`;
    
    // Determine winner
    let winnerId = null;
    if (p1.winner) winnerId = p1Entrant?.startgg_entrant_id;
    else if (p2.winner) winnerId = p2Entrant?.startgg_entrant_id;

    if (!winnerId) throw new Error('Match has no winner');

    // 4. Send to Challonge
    const apiKey = process.env.CHALLONGE_API_KEY;
    if (!apiKey) throw new Error('CHALLONGE_API_KEY is missing');

    const challongeUrl = `https://api.challonge.com/v1/tournaments/${challongeTournamentId}/matches/${challongeMatchId}.json?api_key=${apiKey}`;
    
    const body = {
      match: {
        scores_csv: scoreCsv,
        winner_id: winnerId
      }
    };

    const response = await fetch(challongeUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to report to Challonge');
    }

    return NextResponse.json({ success: true, message: 'Match reported to Challonge' });

  } catch (error: any) {
    console.error('Challonge Report Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to report match' }, { status: 500 });
  }
}
