'use client';

import { useState, useEffect } from 'react';
import { 
  UserCog, Shield, ShieldAlert, Zap, User, 
  Search, Plus, X, Loader2, Clock, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSupabase } from '@/lib/supabase';
import { Role, Player } from '@/types';
import { toast } from 'sonner';

export default function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const supabase = getSupabase();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, assignmentsRes] = await Promise.all([
        supabase.from('roles').select('*').order('name'),
        supabase.from('user_roles').select(`
          *,
          players!user_roles_player_id_fkey (
            id,
            display_name,
            username,
            avatar_url
          ),
          roles (
            name
          )
        `).order('assigned_at', { ascending: false })
      ]);

      if (rolesRes.error) throw rolesRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;

      setRoles(rolesRes.data || []);
      setAssignments(assignmentsRes.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [supabase]);

  const handlePlayerSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedPlayer || !selectedRole) return;

    try {
      // Check if already has this role
      const exists = assignments.find(a => a.player_id === selectedPlayer.id && a.role_id === selectedRole);
      if (exists) {
        toast.error('Player already has this role');
        return;
      }

      const { error } = await supabase
        .from('user_roles')
        .insert({
          player_id: selectedPlayer.id,
          role_id: selectedRole
        });

      if (error) throw error;

      toast.success('Role assigned successfully');
      setSelectedPlayer(null);
      setSelectedRole('');
      setSearchQuery('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign role');
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Assignment removed');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove assignment');
    }
  };

  const getPermissionBadge = (perm: string, value: boolean) => {
    if (!value) return null;
    return (
      <span key={perm} className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[7px] font-black uppercase tracking-widest text-primary">
        {perm.replace('can_', '').replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
          <UserCog className="text-primary" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">Role Management</h1>
          <p className="text-sm text-muted-foreground">Define permissions and assign roles to bladers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Roles List */}
        <div className="space-y-6">
          <h2 className="text-xl font-black uppercase tracking-tight italic flex items-center gap-2">
            <Shield size={20} className="text-primary" />
            System Roles
          </h2>
          
          <div className="space-y-4">
            {loading ? (
              <div className="p-12 text-center bg-white/5 rounded-2xl border border-white/10">
                <Loader2 className="text-primary animate-spin mx-auto mb-4" size={32} />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading roles...</p>
              </div>
            ) : (
              roles.map((role) => (
                <motion.div
                  key={role.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        role.name === 'Admin' ? 'bg-red-500/10 text-red-500' :
                        role.name === 'Ops' ? 'bg-amber-500/10 text-amber-500' :
                        role.name === 'Referee' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-white/10 text-white'
                      }`}>
                        {role.name === 'Admin' ? <ShieldAlert size={20} /> :
                         role.name === 'Ops' ? <Shield size={20} /> :
                         role.name === 'Referee' ? <Zap size={20} /> :
                         <User size={20} />}
                      </div>
                      <div>
                        <h3 className="font-black uppercase tracking-tight italic">{role.name}</h3>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{role.description}</p>
                      </div>
                    </div>
                    {!role.is_custom && (
                      <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[8px] font-black uppercase tracking-widest text-muted-foreground">System</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(role.permissions).map(([key, value]) => getPermissionBadge(key, value as boolean))}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Right: Assign Roles */}
        <div className="space-y-8">
          <div className="p-8 rounded-3xl bg-primary/5 border border-primary/20">
            <h2 className="text-xl font-black uppercase tracking-tight italic mb-6 flex items-center gap-2">
              <Plus size={20} className="text-primary" />
              Assign New Role
            </h2>

            <div className="space-y-6">
              <div className="relative">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 mb-2 block">Search Blader</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <input
                    type="text"
                    placeholder="Type name or username..."
                    value={searchQuery}
                    onChange={(e) => handlePlayerSearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-all"
                  />
                </div>

                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                    >
                      {searchResults.map((player) => (
                        <button
                          key={player.id}
                          onClick={() => {
                            setSelectedPlayer(player);
                            setSearchResults([]);
                            setSearchQuery(player.display_name);
                          }}
                          className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10">
                            {player.avatar_url ? (
                              <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-secondary flex items-center justify-center"><User size={14} className="text-primary" /></div>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-tight italic">{player.display_name}</p>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">@{player.username}</p>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 mb-2 block">Select Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
                      className={`p-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all text-center ${
                        selectedRole === role.id 
                          ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                          : 'bg-white/5 border-white/10 text-muted-foreground hover:border-white/20'
                      }`}
                    >
                      {role.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleAssignRole}
                disabled={!selectedPlayer || !selectedRole}
                className="w-full py-4 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                Assign Role
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-black uppercase tracking-tight italic flex items-center gap-2">
              <Clock size={20} className="text-primary" />
              Current Assignments
            </h2>

            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/5">
                    <th className="p-4 text-[8px] font-black uppercase tracking-widest text-muted-foreground">Blader</th>
                    <th className="p-4 text-[8px] font-black uppercase tracking-widest text-muted-foreground">Role</th>
                    <th className="p-4 text-[8px] font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full overflow-hidden border border-white/10">
                            {assignment.players?.avatar_url ? (
                              <img src={assignment.players.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-secondary flex items-center justify-center"><User size={10} className="text-primary" /></div>
                            )}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-tight italic">{assignment.players?.display_name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                          assignment.roles?.name === 'Admin' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                          assignment.roles?.name === 'Ops' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                          assignment.roles?.name === 'Referee' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                          'bg-white/5 text-muted-foreground border-white/10'
                        }`}>
                          {assignment.roles?.name}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleRemoveAssignment(assignment.id)}
                          className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
