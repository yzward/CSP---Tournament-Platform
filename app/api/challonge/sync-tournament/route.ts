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

    // 2. Fetch from Challonge
    const apiKey = process.env.CHALLONGE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'CHALLONGE_API_KEY is missing' }, { status: 500 });
    }

    const challongeUrl = `https://api.challonge.com/v1/tournaments/${challongeId}.json?include_participants=1&include_matches=1&api_key=${apiKey}`;
    const response = await fetch(challongeUrl);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch from Challonge');
    }

    const challongeData = result.tournament;

    // 3. Sync Participants
    const participants = challongeData.participants.map((p: any) => p.participant);
    
    for (const p of participants) {
      const name = p.display_name || p.name;
      
      // Try to find existing player by startgg_user_id (we'll use this for challonge ID for now to avoid schema changes)
      // Actually, let's just match by name or create a new one.
      let { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('display_name', name)
        .maybeSingle();

      if (!player) {
        const { data: newPlayer } = await supabase
          .from('players')
          .insert({
            display_name: name,
            username: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
            discord_id: p.id.toString(), // Store challonge ID here temporarily if needed, or just generate a random one
            region: 'Global',
            club: 'None'
          })
          .select('id')
          .single();
        player = newPlayer;
      }

      if (player) {
        // Check if entrant exists
        const { data: existingEntrant } = await supabase
          .from('tournament_entrants')
          .select('id')
          .eq('tournament_id', tournamentId)
          .eq('player_id', player.id)
          .maybeSingle();

        if (!existingEntrant) {
          await supabase
            .from('tournament_entrants')
            .insert({
              tournament_id: tournamentId,
              player_id: player.id,
              status: 'active',
              startgg_entrant_id: p.id.toString() // Store challonge participant ID here
            });
        } else {
          await supabase
            .from('tournament_entrants')
            .update({ startgg_entrant_id: p.id.toString() })
            .eq('id', existingEntrant.id);
        }
      }
    }

    // 4. Sync Matches
    const matches = challongeData.matches.map((m: any) => m.match);
    
    // Get all entrants for this tournament to map challonge participant IDs to our player IDs
    // REFRESH ENTRANTS after participant sync to ensure we have the latest startgg_entrant_id mappings
    const { data: entrants } = await supabase
      .from('tournament_entrants')
      .select('player_id, startgg_entrant_id')
      .eq('tournament_id', tournamentId);

    const entrantMap = new Map(entrants?.map(e => [e.startgg_entrant_id, e.player_id]));

    for (const m of matches) {
      // Sync open, pending, and complete matches
      if (m.state !== 'open' && m.state !== 'pending' && m.state !== 'complete') continue;

      const player1_id = m.player1_id ? entrantMap.get(m.player1_id.toString()) : null;
      const player2_id = m.player2_id ? entrantMap.get(m.player2_id.toString()) : null;

      // We can sync matches even if one or both players are TBD (null)
      // but we need at least one player to create match_players records meaningfully
      // Actually, let's create the match anyway so it shows up in the bracket

      // Check if match exists
      let { data: match } = await supabase
        .from('matches')
        .select('id, status')
        .eq('evaroon_match_id', m.id.toString())
        .maybeSingle();

      const scores = m.scores_csv ? m.scores_csv.split('-').map((s: string) => parseInt(s.trim())) : [0, 0];
      const status = m.state === 'complete' ? 'submitted' : 'pending';

      if (!match) {
        const { data: newMatch } = await supabase
          .from('matches')
          .insert({
            tournament_id: tournamentId,
            evaroon_match_id: m.id.toString(),
            status: status,
            stage: m.round > 0 ? `Round ${m.round}` : `Losers Round ${Math.abs(m.round)}`,
            winner_id: m.winner_id ? entrantMap.get(m.winner_id.toString()) : null
          })
          .select('id')
          .single();
        match = newMatch;
      } else if (match.status !== 'submitted' && status === 'submitted') {
        // Update to submitted if it was pending
        await supabase
          .from('matches')
          .update({ 
            status: 'submitted',
            winner_id: m.winner_id ? entrantMap.get(m.winner_id.toString()) : null
          })
          .eq('id', match.id);
      }

      if (match) {
        // Upsert match players
        // We ensure match_players exist for any non-null player IDs
        const { data: existingPlayers } = await supabase.from('match_players').select('id, player_id').eq('match_id', match.id);
        
        const playersToUpsert = [];
        if (player1_id) {
          playersToUpsert.push({
            match_id: match.id,
            player_id: player1_id,
            sets_won: scores[0] || 0,
            total_points: scores[0] || 0,
            winner: m.winner_id?.toString() === m.player1_id?.toString()
          });
        }
        if (player2_id) {
          playersToUpsert.push({
            match_id: match.id,
            player_id: player2_id,
            sets_won: scores[1] || 0,
            total_points: scores[1] || 0,
            winner: m.winner_id?.toString() === m.player2_id?.toString()
          });
        }

        if (playersToUpsert.length > 0) {
          // Use upsert with onConflict if we had a unique constraint, 
          // but for now let's just delete and re-insert or update individually
          for (const p of playersToUpsert) {
            const existing = existingPlayers?.find(ep => ep.player_id === p.player_id);
            if (existing) {
              await supabase.from('match_players').update(p).eq('id', existing.id);
            } else {
              await supabase.from('match_players').insert(p);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Synced successfully from Challonge' });

  } catch (error: any) {
    console.error('Challonge Sync Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync' }, { status: 500 });
  }
}
