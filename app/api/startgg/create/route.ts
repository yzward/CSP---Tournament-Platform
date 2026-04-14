import { NextResponse } from 'next/server';
import { fetchStartGG, CREATE_TOURNAMENT_MUTATION, CREATE_EVENT_MUTATION } from '@/lib/startgg';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { name, slug, date, organizationId, gameId = 1, format = 'single_elimination', location = 'Online', top_cut_size = null, organiser_id = null } = await req.json();
    
    if (!name || !slug || !date || !organizationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const startAt = Math.floor(new Date(date).getTime() / 1000);
    const endAt = startAt + (60 * 60 * 24); // Default 1 day

    // 1. Create Tournament on start.gg
    const tournamentData = await fetchStartGG(CREATE_TOURNAMENT_MUTATION, {
      input: {
        name,
        slug,
        startAt,
        endAt,
        ownerId: organizationId,
        isOnline: location.toLowerCase().includes('online')
      }
    });

    const tournamentId = tournamentData.createTournament.id;
    const tournamentSlug = tournamentData.createTournament.slug;

    // 2. Create Event on start.gg
    const eventData = await fetchStartGG(CREATE_EVENT_MUTATION, {
      tournamentId,
      input: {
        name: 'Main Event',
        videogameId: parseInt(gameId.toString()),
        type: 1 // 1 = Singles
      }
    });

    // 3. Create Tournament in our local DB
    const supabase = getSupabaseAdmin();
    const { data: newTournament, error: dbError } = await supabase
      .from('tournaments')
      .insert({
        name,
        held_at: date,
        format,
        status: 'active',
        evaroon_id: tournamentSlug,
        location,
        top_cut_size: top_cut_size ? parseInt(top_cut_size.toString()) : null,
        organiser_id: organiser_id || null
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ 
      success: true, 
      tournament: newTournament,
      startggUrl: tournamentData.createTournament.url
    });

  } catch (error: any) {
    console.error('Start.gg Create Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create tournament on start.gg' }, { status: 500 });
  }
}
