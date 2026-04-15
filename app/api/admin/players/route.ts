import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('discord_id', user.id)
      .single();

    if (!player) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('player_id', player.id);

    const isAdmin = roleData?.some((r: any) => r.roles?.name === 'Admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, username, display_name, email, club, region, ranking_points, team_id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('players')
      .update({
        username,
        display_name,
        email,
        club,
        region,
        ranking_points,
        team_id: team_id || null
      })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating player:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
