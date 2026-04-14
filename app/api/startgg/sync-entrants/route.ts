import { NextResponse } from 'next/server';
import { fetchStartGG, CREATE_ENTRANTS_MUTATION, GET_TOURNAMENT_QUERY } from '@/lib/startgg';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { tournamentId, playerIds } = await request.json();
    
    if (!tournamentId || !playerIds || !Array.isArray(playerIds)) {
      return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Get tournament details (slug)
    const { data: tournament, error: tError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const slug = tournament.evaroon_id;
    if (!slug) {
      return NextResponse.json({ error: 'Tournament is not linked to start.gg' }, { status: 400 });
    }

    // 2. Fetch start.gg tournament to get event ID
    // We assume the first event is the one we want to sync to
    const startggData = await fetchStartGG(GET_TOURNAMENT_QUERY, { slug });
    const event = startggData?.tournament?.events?.[0];

    if (!event) {
      return NextResponse.json({ error: 'No events found for this tournament on start.gg' }, { status: 404 });
    }

    const eventId = event.id;

    // 3. Fetch players to sync
    let playersToSync = [];
    if (playerIds && Array.isArray(playerIds) && playerIds.length > 0) {
      const { data: pData, error: pError } = await supabase
        .from('players')
        .select('*')
        .in('id', playerIds);
      if (pError || !pData) throw new Error('Failed to fetch players');
      playersToSync = pData;
    } else {
      // Fetch all entrants for this tournament
      const { data: entrantsData, error: eError } = await supabase
        .from('tournament_entrants')
        .select('*, players(*)')
        .eq('tournament_id', tournamentId);
      
      if (eError || !entrantsData) throw new Error('Failed to fetch tournament entrants');
      playersToSync = entrantsData.map((e: any) => e.players).filter(Boolean);
    }

    if (playersToSync.length === 0) {
      return NextResponse.json({ error: 'No players found to sync' }, { status: 400 });
    }

    // 4. Format entrants for start.gg
    const entrants = playersToSync.map(p => ({
      name: p.display_name,
      participants: [
        {
          gamerTag: p.display_name,
          email: p.email || undefined,
          // If we have their start.gg user ID, we link it directly
          userId: p.startgg_user_id || undefined
        }
      ]
    }));

    // 5. Push to start.gg
    const syncResult = await fetchStartGG(CREATE_ENTRANTS_MUTATION, {
      eventId,
      entrants
    });

    const createdEntrants = syncResult?.createEntrants || [];

    // 6. Save entrant IDs back to our DB
    for (const player of playersToSync) {
      const startggEntrant = createdEntrants.find((e: any) => e.name === player.display_name);
      
      if (startggEntrant) {
        await supabase
          .from('tournament_entrants')
          .update({ startgg_entrant_id: startggEntrant.id })
          .eq('tournament_id', tournamentId)
          .eq('player_id', player.id);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully synced ${entrants.length} players to start.gg`,
      data: syncResult
    });

  } catch (error: any) {
    console.error('Start.gg Sync Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync entrants to start.gg' }, { status: 500 });
  }
}
