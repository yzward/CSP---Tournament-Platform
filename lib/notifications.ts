import { getSupabase } from './supabase';

export async function createNotification(playerId: string, type: string, message: string, link?: string) {
  const supabase = getSupabase();
  const { error } = await (supabase as any)
    .from('notifications')
    .insert({
      player_id: playerId,
      type,
      message,
      link
    });
  
  if (error) {
    console.error('Error creating notification:', error);
  }
}

export async function notifyAdmins(type: string, message: string, link?: string) {
  const supabase = getSupabase();
  
  // Find all admins
  const { data: adminRoles } = await (supabase as any)
    .from('roles')
    .select('id')
    .eq('name', 'Admin');
  
  if (!adminRoles || adminRoles.length === 0) return;
  
  const adminRoleIds = adminRoles.map(r => r.id);
  
  const { data: admins } = await (supabase as any)
    .from('user_roles')
    .select('player_id')
    .in('role_id', adminRoleIds);
  
  if (!admins) return;
  
  const notifications = admins.map(a => ({
    player_id: a.player_id,
    type,
    message,
    link
  }));
  
  const { error } = await (supabase as any)
    .from('notifications')
    .insert(notifications);
    
  if (error) {
    console.error('Error notifying admins:', error);
  }
}

export async function notifyRefs(type: string, message: string, link?: string) {
  const supabase = getSupabase();
  
  // Find all refs and ops
  const { data: refRoles } = await (supabase as any)
    .from('roles')
    .select('id')
    .in('name', ['Referee', 'Ops', 'Admin']);
  
  if (!refRoles || refRoles.length === 0) return;
  
  const refRoleIds = refRoles.map(r => r.id);
  
  const { data: refs } = await (supabase as any)
    .from('user_roles')
    .select('player_id')
    .in('role_id', refRoleIds);
  
  if (!refs) return;
  
  // Unique player IDs
  const playerIds = Array.from(new Set(refs.map(r => r.player_id)));
  
  const notifications = playerIds.map(id => ({
    player_id: id,
    type,
    message,
    link
  }));
  
  const { error } = await (supabase as any)
    .from('notifications')
    .insert(notifications);
    
  if (error) {
    console.error('Error notifying refs:', error);
  }
}
