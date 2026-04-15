import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await req.json();
  const { action, claimId, playerId, authUserId } = body;

  if (!action || !claimId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (action === 'approve') {
    if (!playerId || !authUserId) {
      return NextResponse.json({ error: 'Missing playerId or authUserId for approval' }, { status: 400 });
    }

    // Link the auth user to the player record
    const { error: linkError } = await supabase
      .from('players')
      .update({ discord_id: authUserId, status: 'approved' })
      .eq('id', playerId);

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    // Assign the Player role if not already assigned
    const { data: role } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'Player')
      .single();

    if (role) {
      await supabase.from('user_roles').insert({
        player_id: playerId,
        role_id: role.id,
      }).select(); // ignore conflict
    }

    // Mark claim as approved
    const { error: claimError } = await supabase
      .from('account_claims')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', claimId);

    if (claimError) {
      return NextResponse.json({ error: claimError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'deny') {
    const { error } = await supabase
      .from('account_claims')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', claimId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
