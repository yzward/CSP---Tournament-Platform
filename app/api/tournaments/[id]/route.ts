import { getSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === 'complete') {
      const { placements } = body;
      if (!placements || !Array.isArray(placements)) {
        return NextResponse.json({ error: 'Invalid placements data' }, { status: 400 });
      }

      // 1. Update tournament status
      const { error: tournamentError } = await (supabase as any)
        .from('tournaments')
        .update({ status: 'completed' })
        .eq('id', id);

      if (tournamentError) throw tournamentError;

      // 2. Upsert placements into tournament_entrants
      const entrantsData = placements.map((p: any) => ({
        tournament_id: id,
        player_id: p.player_id,
        placement: p.placement
      }));

      const { error: entrantsError } = await (supabase as any)
        .from('tournament_entrants')
        .upsert(entrantsData, { onConflict: 'tournament_id,player_id' });

      if (entrantsError) throw entrantsError;

      // 3. Call award_tournament_points function
      const { data: pointsData, error: pointsError } = await (supabase as any)
        .rpc('award_tournament_points', { t_id: id });

      if (pointsError) throw pointsError;

      // 4. Trigger Discord notification (async)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`;
      fetch(`${baseUrl}/api/discord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'tournament_complete', tournamentId: id })
      }).catch(err => console.error('Failed to trigger Discord notification:', err));

      return NextResponse.json({ 
        success: true, 
        message: 'Tournament completed and points awarded',
        summary: pointsData 
      });
    }

    if (action === 'sync') {
      const { is_ranking, tier_multiplier } = body;

      const { error } = await (supabase as any)
        .from('tournaments')
        .update({ 
          is_ranking,
          tier_multiplier
        })
        .eq('id', id);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('Tournament API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = await params;

    // Get match IDs first, then delete dependents
    const { data: matchRows } = await (supabase as any).from('matches').select('id').eq('tournament_id', id);
    const matchIds = (matchRows || []).map((m: any) => m.id);

    if (matchIds.length > 0) {
      await (supabase as any).from('finish_events').delete().in('match_id', matchIds);
      await (supabase as any).from('match_players').delete().in('match_id', matchIds);
    }
    await (supabase as any).from('matches').delete().eq('tournament_id', id);
    await (supabase as any).from('tournament_entrants').delete().eq('tournament_id', id);
    await (supabase as any).from('brackets').delete().eq('tournament_id', id);
    await (supabase as any).from('courts').delete().eq('tournament_id', id);

    const { error } = await (supabase as any).from('tournaments').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete tournament error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = await params;

    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
