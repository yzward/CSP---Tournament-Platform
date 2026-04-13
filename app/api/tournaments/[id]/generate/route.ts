import { getSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { BracketsManager } from 'brackets-manager';
import { InMemoryDatabase } from 'brackets-memory-db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id: tournamentId } = await params;

    // Fetch tournament
    const { data: tournament, error: tErr } = await (supabase as any)
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tErr || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Fetch entrants sorted by ranking_points desc (seeding order)
    const { data: entrants, error: eErr } = await (supabase as any)
      .from('tournament_entrants')
      .select('player_id, players(id, display_name, ranking_points)')
      .eq('tournament_id', tournamentId)
      .order('players(ranking_points)', { ascending: false });

    if (eErr) throw eErr;
    if (!entrants || entrants.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 players' }, { status: 400 });
    }

    // Map format to brackets-manager type
    const formatMap: Record<string, any> = {
      single_elim: 'single_elimination',
      double_elim: 'double_elimination',
      round_robin: 'round_robin',
      swiss:       'round_robin', // brackets-manager uses round_robin for swiss-style seeding
    };

    const stageType = formatMap[tournament.stage1_format] || 'single_elimination';

    // Build participant list (seeded order)
    const participants = entrants.map((e: any) => ({
      id: e.player_id,
      name: e.players?.display_name || e.player_id,
    }));

    const isRoundRobin = stageType === 'round_robin';

    // Elimination brackets require power-of-2 participant count (pad with null byes)
    // Round robin supports any count — no padding needed
    const bracketSize = isRoundRobin
      ? participants.length
      : Math.pow(2, Math.ceil(Math.log2(Math.max(participants.length, 2))));

    const seeding: (string | null)[] = participants.map((p: any) => p.name);
    while (seeding.length < bracketSize) seeding.push(null);

    // Generate bracket in memory
    const db = new InMemoryDatabase();
    const manager = new BracketsManager(db);

    const stageSettings: any = {
      seedOrdering: ['natural'],
      balanceByes: !isRoundRobin,
      size: bracketSize,
    };

    // round_robin requires groupCount — 1 = everyone in one group (Swiss-style)
    if (isRoundRobin) {
      stageSettings.groupCount = 1;
    }

    await manager.create.stage({
      name: tournament.name,
      tournamentId,
      type: stageType,
      seeding,
      settings: stageSettings,
    });

    // Export the full in-memory state
    const exportedData = await manager.get.stageData(0);

    // Delete existing bracket + pending matches for this tournament
    await (supabase as any).from('brackets').delete().eq('tournament_id', tournamentId);

    // Only delete matches that haven't been started yet
    const { data: pendingMatches } = await (supabase as any)
      .from('matches').select('id').eq('tournament_id', tournamentId).eq('status', 'pending');
    if (pendingMatches?.length) {
      const ids = pendingMatches.map((m: any) => m.id);
      await (supabase as any).from('match_players').delete().in('match_id', ids);
      await (supabase as any).from('matches').delete().in('id', ids);
    }

    // Save bracket JSON
    const { error: saveErr } = await (supabase as any)
      .from('brackets')
      .insert({ tournament_id: tournamentId, data: exportedData, updated_at: new Date().toISOString() });
    if (saveErr) throw saveErr;

    // Build brackets-manager participant ID → player UUID
    // Match by name so we're not assuming position index == internal ID
    const nameToUuid: Record<string, string> = {};
    participants.forEach((p: any) => { nameToUuid[p.name] = p.id; });

    const participantMap: Record<number, string> = {};
    for (const bp of (exportedData.participant as any[])) {
      if (bp.name && nameToUuid[bp.name]) {
        participantMap[bp.id] = nameToUuid[bp.name];
      }
    }

    // Create match rows for every bracket match where both players are known (not a bye)
    const bracketMatches = (exportedData.match as any[]).filter(
      (bm: any) => bm.opponent1?.id != null && bm.opponent2?.id != null
    );

    for (const bm of bracketMatches) {
      const p1Id = participantMap[bm.opponent1.id];
      const p2Id = participantMap[bm.opponent2.id];
      if (!p1Id || !p2Id) continue;

      const { data: matchRow } = await (supabase as any)
        .from('matches')
        .insert({ tournament_id: tournamentId, status: 'pending', stage: `Round ${bm.round_id + 1}` })
        .select('id').single();

      if (!matchRow) continue;

      await (supabase as any).from('match_players').insert([
        { match_id: matchRow.id, player_id: p1Id },
        { match_id: matchRow.id, player_id: p2Id },
      ]);
    }

    return NextResponse.json({ success: true, matchesCreated: bracketMatches.length });
  } catch (error: any) {
    console.error('Generate bracket error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
