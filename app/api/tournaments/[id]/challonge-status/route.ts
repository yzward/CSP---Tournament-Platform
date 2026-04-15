import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseTournamentId } from '@/lib/challonge';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: tournament, error: tError } = await supabase
      .from('tournaments')
      .select('challonge_id')
      .eq('id', id)
      .single();

    if (tError || !tournament || !tournament.challonge_id) {
      return NextResponse.json({ status: 'unknown' });
    }

    const { id: challongeId } = parseTournamentId(tournament.challonge_id);
    const apiKey = process.env.CHALLONGE_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ status: 'unknown', error: 'API Key missing' });
    }

    const response = await fetch(`https://api.challonge.com/v1/tournaments/${challongeId}.json?api_key=${apiKey}`);
    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ status: 'unknown' });
    }

    return NextResponse.json({ 
      status: result.tournament.state,
      started_at: result.tournament.started_at 
    });

  } catch (error) {
    return NextResponse.json({ status: 'unknown' }, { status: 500 });
  }
}
