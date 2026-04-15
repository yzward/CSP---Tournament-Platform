import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseTournamentId } from '@/lib/challonge';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse Challonge scores_csv (e.g. "2-1" or null) → [sets_won1, sets_won2] */
function parseScores(scores_csv: string | null): [number, number] {
  if (!scores_csv) return [0, 0];
  // Challonge format: "2-1" (sets won by player1, player2)
  // For best-of multi-game: "2-1,1-2,2-0" — take totals
  const games = scores_csv.split(',');
  let s1 = 0, s2 = 0;
  for (const g of games) {
    const parts = g.trim().split('-');
    s1 += parseInt(parts[0]) || 0;
    s2 += parseInt(parts[1]) || 0;
  }
  return [s1, s2];
}

/** Challonge match states that are worth syncing */
const SYNCABLE_STATES = new Set(['open', 'pending', 'underway', 'complete']);

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const errors: string[] = [];

  try {
    const { tournamentId } = await req.json();
    if (!tournamentId) {
      return NextResponse.json({ error: 'Missing tournament ID' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // ── 1. Load local tournament ────────────────────────────────────────────
    const { data: tournament, error: tError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (!tournament.evaroon_id) {
      return NextResponse.json(
        { error: 'Tournament is not linked to Challonge. Set the evaroon_id field first.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.CHALLONGE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'CHALLONGE_API_KEY is not configured' }, { status: 500 });
    }

    // ── 2. Fetch from Challonge (V3 pattern: clean parse, validate response) ─
    const { id: challongeId } = parseTournamentId(tournament.evaroon_id);
    const challongeUrl =
      `https://api.challonge.com/v1/tournaments/${challongeId}.json` +
      `?include_participants=1&include_matches=1&api_key=${apiKey}`;

    const challongeRes = await fetch(challongeUrl);
    const challongeRaw = await challongeRes.json();

    if (!challongeRes.ok) {
      console.error('[Sync] Challonge API error:', challongeRaw);
      return NextResponse.json(
        { error: challongeRaw?.errors?.[0] || `Challonge returned ${challongeRes.status}` },
        { status: 502 }
      );
    }

    // Validate the response shape (V3 pattern)
    if (!challongeRaw?.tournament) {
      return NextResponse.json(
        { error: 'Unexpected Challonge response — tournament wrapper missing' },
        { status: 502 }
      );
    }

    const ct = challongeRaw.tournament;
    const participants: any[] = (ct.participants || []).map((p: any) => p.participant);
    const matches: any[]      = (ct.matches      || []).map((m: any) => m.match);

    console.log(`[Sync] ${ct.name} — ${participants.length} participants, ${matches.length} matches`);

    // ── 3. Sync participants ────────────────────────────────────────────────
    //
    // Match order (most → least specific):
    //   a) Existing tournament_entrant with matching startgg_entrant_id  → already synced
    //   b) Player found by display_name                                  → link & upsert entrant
    //   c) No match                                                       → create player, then entrant
    //
    // We deliberately do NOT store Challonge IDs in players.discord_id.
    // That field is reserved for Discord snowflakes.

    for (const p of participants) {
      const name = (p.display_name || p.name || '').trim();
      if (!name) continue;

      const challongeParticipantId = p.id?.toString();

      try {
        // a) Already have an entrant with this Challonge participant ID?
        const { data: existingEntrant } = await supabase
          .from('tournament_entrants')
          .select('id, player_id')
          .eq('tournament_id', tournamentId)
          .eq('startgg_entrant_id', challongeParticipantId)
          .maybeSingle();

        if (existingEntrant) {
          // Already synced — nothing to do
          continue;
        }

        // b) Find player by display_name (case-insensitive)
        let { data: player } = await supabase
          .from('players')
          .select('id')
          .ilike('display_name', name)
          .maybeSingle();

        // c) Create player if not found
        if (!player) {
          const safeUsername = name
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 30) || `player_${challongeParticipantId}`;

          const { data: newPlayer, error: createErr } = await supabase
            .from('players')
            .insert({
              display_name: name,
              username: safeUsername,
              // discord_id intentionally omitted — nullable after migration
              region: 'Global',
              club: 'None',
            })
            .select('id')
            .single();

          if (createErr || !newPlayer) {
            errors.push(`Failed to create player "${name}": ${createErr?.message}`);
            continue;
          }
          player = newPlayer;
        }

        // Upsert tournament_entrant (handles duplicate tournament/player combos safely)
        const { error: entrantErr } = await supabase
          .from('tournament_entrants')
          .upsert(
            {
              tournament_id: tournamentId,
              player_id: player.id,
              startgg_entrant_id: challongeParticipantId,
              status: 'active',
            },
            { onConflict: 'tournament_id,player_id' }
          );

        if (entrantErr) {
          errors.push(`Failed to upsert entrant "${name}": ${entrantErr.message}`);
        }
      } catch (err: any) {
        errors.push(`Error processing participant "${name}": ${err.message}`);
      }
    }

    // ── 4. Build entrant map (Challonge participant ID → local player UUID) ──
    const { data: entrants } = await supabase
      .from('tournament_entrants')
      .select('player_id, startgg_entrant_id')
      .eq('tournament_id', tournamentId)
      .not('startgg_entrant_id', 'is', null);

    const entrantMap = new Map<string, string>(
      (entrants || []).map(e => [e.startgg_entrant_id!.toString(), e.player_id])
    );
    console.log(`[Sync] Entrant map: ${entrantMap.size} entries`);

    // ── 5. Sync matches ─────────────────────────────────────────────────────
    let syncedCount = 0;

    for (const m of matches) {
      if (!SYNCABLE_STATES.has(m.state)) {
        console.log(`[Sync] Skipping match ${m.id} (state: ${m.state})`);
        continue;
      }

      const player1_id  = m.player1_id ? entrantMap.get(m.player1_id.toString()) ?? null : null;
      const player2_id  = m.player2_id ? entrantMap.get(m.player2_id.toString()) ?? null : null;
      const winner_id   = m.winner_id  ? entrantMap.get(m.winner_id.toString())  ?? null : null;
      const isComplete  = m.state === 'complete';
      const matchStatus = isComplete ? 'submitted' : 'pending';
      const [sets1, sets2] = parseScores(m.scores_csv);
      const roundLabel = m.round > 0
        ? `Round ${m.round}`
        : `Losers Round ${Math.abs(m.round)}`;

      try {
        // Look up by Challonge match ID (idempotent re-sync)
        let { data: match } = await supabase
          .from('matches')
          .select('id, status')
          .eq('evaroon_match_id', m.id.toString())
          .maybeSingle();

        if (!match) {
          // Create new match
          const { data: newMatch, error: mErr } = await supabase
            .from('matches')
            .insert({
              tournament_id: tournamentId,
              evaroon_match_id: m.id.toString(),
              status: matchStatus,
              stage: roundLabel,
              winner_id,
            })
            .select('id, status')
            .single();

          if (mErr || !newMatch) {
            errors.push(`Failed to create match (Challonge ${m.id}): ${mErr?.message}`);
            continue;
          }
          match = newMatch;
        } else if (match.status !== 'submitted' && isComplete) {
          // Promote to submitted once Challonge marks it complete
          await supabase
            .from('matches')
            .update({ status: 'submitted', winner_id })
            .eq('id', match.id);
        }

        // ── Upsert match_players ──────────────────────────────────────────
        // Fetch existing rows so we can diff cleanly
        const { data: existingMPs } = await supabase
          .from('match_players')
          .select('id, player_id')
          .eq('match_id', match.id);

        const desired: { match_id: string; player_id: string; sets_won: number; total_points: number; winner: boolean }[] = [];
        if (player1_id) {
          desired.push({
            match_id: match.id,
            player_id: player1_id,
            sets_won: sets1,
            total_points: sets1,
            winner: winner_id === player1_id,
          });
        }
        if (player2_id) {
          desired.push({
            match_id: match.id,
            player_id: player2_id,
            sets_won: sets2,
            total_points: sets2,
            winner: winner_id === player2_id,
          });
        }

        // Remove stale match_players (player was re-assigned in bracket)
        const desiredPlayerIds = new Set(desired.map(d => d.player_id));
        const toRemove = (existingMPs || []).filter(ep => !desiredPlayerIds.has(ep.player_id));
        if (toRemove.length > 0) {
          await supabase
            .from('match_players')
            .delete()
            .in('id', toRemove.map(r => r.id));
        }

        // Upsert desired match_players
        for (const mp of desired) {
          const existing = (existingMPs || []).find(ep => ep.player_id === mp.player_id);
          if (existing) {
            await supabase.from('match_players').update(mp).eq('id', existing.id);
          } else {
            await supabase.from('match_players').insert(mp);
          }
        }

        syncedCount++;
      } catch (err: any) {
        errors.push(`Error processing match ${m.id}: ${err.message}`);
      }
    }

    console.log(`[Sync] Done — ${syncedCount} matches synced, ${errors.length} errors`);
    return NextResponse.json({
      success: true,
      message: `Synced ${participants.length} participants and ${syncedCount} matches from Challonge`,
      ...(errors.length > 0 && { warnings: errors }),
    });

  } catch (error: any) {
    console.error('[Sync] Unhandled error:', error);
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
