import { getSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    
    // 1. Invite user via Supabase Auth
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${new URL(request.url).origin}/auth/reset-password`,
    });
    
    if (inviteError) throw inviteError;

    // 2. Create player record (pending)
    const username = email.split('@')[0];
    const { error: dbError } = await (supabaseAdmin as any).from('players').insert({
      username,
      display_name: username,
      discord_id: email, // Using email as temporary discord_id for email-only users
      status: 'pending',
      ranking_points: 0
    });

    if (dbError) throw dbError;

    // 3. Assign default 'Player' role
    const { data: role } = await (supabaseAdmin as any)
      .from('roles')
      .select('id')
      .eq('name', 'Player')
      .single();
    
    if (role) {
      const { data: newPlayer } = await (supabaseAdmin as any)
        .from('players')
        .select('id')
        .eq('discord_id', email)
        .single();
      
      if (newPlayer) {
        await (supabaseAdmin as any).from('user_roles').insert({
          player_id: newPlayer.id,
          role_id: role.id
        });
      }
    }

    return NextResponse.json({ message: 'Invitation sent successfully' });
  } catch (error: any) {
    console.error('Invite error:', error);
    return NextResponse.json({ error: error.message || 'Failed to invite user' }, { status: 500 });
  }
}
