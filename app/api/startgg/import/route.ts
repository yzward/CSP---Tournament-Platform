import { NextResponse } from 'next/server';
import { fetchStartGG, GET_TOURNAMENT_QUERY } from '@/lib/startgg';

export async function POST(request: Request) {
  try {
    const { slug } = await request.json();
    
    if (!slug) {
      return NextResponse.json({ error: 'Tournament slug is required' }, { status: 400 });
    }

    const data = await fetchStartGG(GET_TOURNAMENT_QUERY, { slug });
    
    if (!data || !data.tournament) {
      return NextResponse.json({ error: 'Tournament not found on start.gg. Please check the slug.' }, { status: 404 });
    }

    return NextResponse.json({ tournament: data.tournament });
  } catch (error: any) {
    console.error('Start.gg Import Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch tournament from start.gg' }, { status: 500 });
  }
}
