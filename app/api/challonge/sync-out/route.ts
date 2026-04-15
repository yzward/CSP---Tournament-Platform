import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseTournamentId } from '@/lib/challonge';

// Push locally-registered entrants to Challonge who don't have a startgg_entrant_id yet.
// Idempotent: re-running only pushes entrants that still haven't been assigned a Challonge ID.

export async function POST(req: Request) {
  try {
    const { tournamentId } = await req.json();
    if (!tournamentId) {
      return NextResponse.json({ error: 'Missing tournament ID' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Load tournament
    const { data: tournament, error: tError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (!tournament.challonge_id) {
      return NextResponse.json({ error: 'Tournament is not linked to Challonge' }, { status: 400 });
    }

    const apiKey = process.env.CHALLONGE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'CHALLONGE_API_KEY is not configured' }, { status: 500 });
    }

    const { id: challongeId } = parseTournamentId(tournament.challonge_id);

    // 2. Get entrants not yet pushed to Challonge
    const { data: entrants, error: eError } = await supabase
      .from('tournament_entrants')
      .select('id, player_id, players(display_name)')
      .eq('tournament_id', tournamentId)
      .is('startgg_entrant_id', null);

    if (eError) throw eError;

    if (!entrants || entrants.length === 0) {
      return NextResponse.json({ success: true, message: 'All entrants are already synced to Challonge' });
    }

    // 3. Verify Challonge tournament is still in a state we can add participants to
    const statusRes = await fetch(
      `https://api.challonge.com/v1/tournaments/${challongeId}.json?api_key=${apiKey}`
    );
    const statusData = await statusRes.json();
    if (!statusRes.ok) {
      return NextResponse.json(
        { error: statusData?.errors?.[0] || `Challonge returned ${statusRes.status}` },
        { status: 502 }
      );
    }
    const challongeState = statusData?.tournament?.state;
    if (challongeState === 'complete') {
      return NextResponse.json({ error: 'Challonge tournament is already complete — cannot add participants' }, { status: 400 });
    }

    // 4. Push each unsynced entrant to Challonge one-by-one (reliable over bulk_add)
    let syncedCount = 0;
    const failures: string[] = [];

    for (const entrant of entrants) {
      const name = (entrant.players as any)?.display_name || 'Unknown Player';

      const response = await fetch(
        `https://api.challonge.com/v1/tournaments/${challongeId}/participants.json?api_key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participant: { name } }),
        }
      );

      const result = await response.json();

      if (response.ok && result.participant?.id) {
        // Save the Challonge participant ID so future syncs use ID-matching not name-matching
        const { error: updateErr } = await supabase
          .from('tournament_entrants')
          .update({ startgg_entrant_id: result.participant.id.toString() })
          .eq('id', entrant.id);

        if (updateErr) {
          failures.push(`Pushed "${name}" to Challonge but failed to save ID locally: ${updateErr.message}`);
        } else {
          syncedCount++;
        }
      } else {
        const errMsg = result?.errors?.join(', ') || result?.error || 'Unknown error';
        console.error(`[Sync Out] Failed to push "${name}":`, result);
        failures.push(`"${name}": ${errMsg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Pushed ${syncedCount} of ${entrants.length} entrants to Challonge`,
      ...(failures.length > 0 && { warnings: failures }),
    });

  } catch (error: any) {
    console.error('[Sync Out] Unhandled error:', error);
    return NextResponse.json({ error: error.message || 'Sync out failed' }, { status: 500 });
  }
}
