import { getSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id: tournamentId } = await params;
    const { roundId } = await request.json(); // The round that just finished (0-indexed)

    // Fetch tournament
    const { data: tournament } = await (supabase as any)
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (!tournament || tournament.stage1_format !== 'swiss') {
      return NextResponse.json({ success: false, message: 'Not a Swiss tournament' });
    }

    // Check if all matches in the current round are submitted
    const stageName = `Round ${roundId + 1}`;
    const { data: roundMatches } = await (supabase as any)
      .from('matches')
      .select('status')
      .eq('tournament_id', tournamentId)
      .eq('stage', stageName);

    if (!roundMatches || roundMatches.length === 0) {
      return NextResponse.json({ success: false, message: 'No matches found for this round' });
    }

    const allSubmitted = roundMatches.every((m: any) => m.status === 'submitted');
    if (!allSubmitted) {
      return NextResponse.json({ success: false, message: 'Round not complete' });
    }

    // Fetch bracket data
    const { data: bracketData } = await (supabase as any)
      .from('brackets')
      .select('*')
      .eq('tournament_id', tournamentId)
      .single();

    if (!bracketData) return NextResponse.json({ success: false, message: 'No bracket data' });

    const exportedData = bracketData.data;
    const nextRoundId = roundId + 1;

    // Get matches for the next round
    const nextRoundMatches = (exportedData.match as any[]).filter(
      (bm: any) => bm.round_id === nextRoundId && bm.opponent1?.id != null && bm.opponent2?.id != null
    );

    if (nextRoundMatches.length === 0) {
      return NextResponse.json({ success: true, message: 'Tournament complete' });
    }

    // Check if we already generated this round
    const { data: existingMatches } = await (supabase as any)
      .from('matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('stage', `Round ${nextRoundId + 1}`)
      .limit(1);

    if (existingMatches && existingMatches.length > 0) {
      return NextResponse.json({ success: true, message: 'Round already generated' });
    }

    // --- SWISS PAIRING LOGIC ---
    // If we want true Swiss, we should re-pair players based on current standings.
    // Let's calculate current standings.
    const statsMap: Record<string, { wins: number; pointDiff: number }> = {};
    
    // Initialize statsMap
    const { data: entrants } = await (supabase as any)
      .from('tournament_entrants')
      .select('player_id, players(display_name)')
      .eq('tournament_id', tournamentId);

    const nameToUuid: Record<string, string> = {};
    const uuidToName: Record<string, string> = {};
    entrants?.forEach((e: any) => {
      const name = e.players?.display_name || e.player_id;
      nameToUuid[name] = e.player_id;
      uuidToName[e.player_id] = name;
      statsMap[e.player_id] = { wins: 0, pointDiff: 0 };
    });

    // Calculate stats
    const { data: allMatches } = await (supabase as any)
      .from('matches')
      .select('id, match_players(player_id, total_points, winner)')
      .eq('tournament_id', tournamentId)
      .eq('status', 'submitted');
    
    allMatches?.forEach((m: any) => {
      const mps = m.match_players || [];
      if (mps.length === 2) {
        const [p1, p2] = mps;
        if (statsMap[p1.player_id]) {
          if (p1.winner) statsMap[p1.player_id].wins++;
          statsMap[p1.player_id].pointDiff += (p1.total_points || 0) - (p2.total_points || 0);
        }
        if (statsMap[p2.player_id]) {
          if (p2.winner) statsMap[p2.player_id].wins++;
          statsMap[p2.player_id].pointDiff += (p2.total_points || 0) - (p1.total_points || 0);
        }
      }
    });

    // Sort players by wins, then point diff
    const sortedPlayers = Object.keys(statsMap).sort((a, b) => {
      if (statsMap[b].wins !== statsMap[a].wins) return statsMap[b].wins - statsMap[a].wins;
      return statsMap[b].pointDiff - statsMap[a].pointDiff;
    });

    // Simple greedy pairing: pair adjacent players
    // In a real Swiss, we'd avoid rematches, but this is a good start.
    const newPairings: Array<[string, string]> = [];
    const used = new Set<string>();
    for (let i = 0; i < sortedPlayers.length; i++) {
      if (used.has(sortedPlayers[i])) continue;
      for (let j = i + 1; j < sortedPlayers.length; j++) {
        if (!used.has(sortedPlayers[j])) {
          newPairings.push([sortedPlayers[i], sortedPlayers[j]]);
          used.add(sortedPlayers[i]);
          used.add(sortedPlayers[j]);
          break;
        }
      }
    }

    // Update the brackets JSON with the new pairings
    const participantMap: Record<number, string> = {};
    const reverseParticipantMap: Record<string, number> = {};
    for (const bp of (exportedData.participant as any[])) {
      if (bp.name && nameToUuid[bp.name]) {
        participantMap[bp.id] = nameToUuid[bp.name];
        reverseParticipantMap[nameToUuid[bp.name]] = bp.id;
      }
    }

    // Apply new pairings to nextRoundMatches
    for (let i = 0; i < nextRoundMatches.length; i++) {
      if (i < newPairings.length) {
        const [p1Id, p2Id] = newPairings[i];
        nextRoundMatches[i].opponent1.id = reverseParticipantMap[p1Id] ?? null;
        nextRoundMatches[i].opponent2.id = reverseParticipantMap[p2Id] ?? null;
      } else {
        nextRoundMatches[i].opponent1.id = null;
        nextRoundMatches[i].opponent2.id = null;
      }
    }

    // Save updated JSON
    await (supabase as any)
      .from('brackets')
      .update({ data: exportedData, updated_at: new Date().toISOString() })
      .eq('tournament_id', tournamentId);

    // Insert matches for the next round
    let createdCount = 0;
    for (const bm of nextRoundMatches) {
      if (bm.opponent1?.id == null || bm.opponent2?.id == null) continue;
      
      const p1Id = participantMap[bm.opponent1.id];
      const p2Id = participantMap[bm.opponent2.id];
      if (!p1Id || !p2Id) continue;

      const { data: matchRow } = await (supabase as any)
        .from('matches')
        .insert({ tournament_id: tournamentId, status: 'pending', stage: `Round ${nextRoundId + 1}` })
        .select('id').single();

      if (matchRow) {
        await (supabase as any).from('match_players').insert([
          { match_id: matchRow.id, player_id: p1Id },
          { match_id: matchRow.id, player_id: p2Id },
        ]);
        createdCount++;
      }
    }

    return NextResponse.json({ success: true, matchesCreated: createdCount });
  } catch (error: any) {
    console.error('Advance round error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
