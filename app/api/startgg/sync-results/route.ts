import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchStartGG, GET_TOURNAMENT_QUERY, GET_SETS_QUERY } from '@/lib/startgg';

export async function POST(req: Request) {
  try {
    const { tournamentId } = await req.json();
    if (!tournamentId) return NextResponse.json({ error: 'Tournament ID is required' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // 1. Fetch tournament details from our DB
    const { data: tournament, error: tError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tError || !tournament) throw new Error('Tournament not found');

    // evaroon_id stores the start.gg slug
    const slug = tournament.evaroon_id;
    if (!slug) throw new Error('Tournament is not linked to start.gg');

    // 2. Fetch tournament info from start.gg to get event and phase group IDs
    const startggData = await fetchStartGG(GET_TOURNAMENT_QUERY, { slug });
    const event = startggData.tournament.events[0];
    if (!event) throw new Error('No events found for this tournament on start.gg');

    const phaseGroups = event.phases?.[0]?.phaseGroups?.nodes || [];
    if (phaseGroups.length === 0) throw new Error('No phase groups found');

    // 3. Fetch all sets for the first phase group (usually the main bracket)
    // In a more complex app, we'd loop through all phase groups
    const phaseGroupId = phaseGroups[0].id;
    const setsData = await fetchStartGG(GET_SETS_QUERY, { phaseGroupId, page: 1 });
    const sets = setsData.phaseGroup.sets.nodes || [];

    // 4. Fetch our entrants to map start.gg IDs to our player IDs
    const { data: entrants, error: eError } = await supabase
      .from('tournament_entrants')
      .select('player_id, startgg_entrant_id')
      .eq('tournament_id', tournamentId);

    if (eError || !entrants) throw new Error('Failed to fetch entrants');

    const entrantMap: Record<string, string> = {};
    entrants.forEach(e => {
      if (e.startgg_entrant_id) entrantMap[e.startgg_entrant_id] = e.player_id;
    });

    // 5. Process sets and update/create matches
    let updatedCount = 0;
    for (const set of sets) {
      if (set.state !== 3) continue; // Only process completed sets (state 3 is COMPLETED)

      const entrant1Id = set.slots[0]?.entrant?.id;
      const entrant2Id = set.slots[1]?.entrant?.id;

      if (!entrant1Id || !entrant2Id) continue;

      const player1Id = entrantMap[entrant1Id];
      const player2Id = entrantMap[entrant2Id];

      if (!player1Id || !player2Id) continue;

      // Check if match already exists
      const { data: existingMatch } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('evaroon_match_id', set.id)
        .maybeSingle();

      if (existingMatch) continue; // Skip if already synced

      // Create new match
      const { data: newMatch, error: mError } = await supabase
        .from('matches')
        .insert({
          tournament_id: tournamentId,
          evaroon_match_id: set.id,
          status: 'submitted',
          stage: set.fullRoundText || 'Bracket',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (mError) {
        console.error('Error creating match:', mError);
        continue;
      }

      // Add match players
      // Note: We don't have the exact score breakdown per game from this query, 
      // but we can mark the winner.
      // For a more detailed sync, we'd need a query that returns game scores.
      await supabase.from('match_players').insert([
        { match_id: newMatch.id, player_id: player1Id, winner: set.winnerId === entrant1Id },
        { match_id: newMatch.id, player_id: player2Id, winner: set.winnerId === entrant2Id }
      ]);

      updatedCount++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully synced ${updatedCount} new matches from start.gg` 
    });

  } catch (error: any) {
    console.error('Sync Results Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
