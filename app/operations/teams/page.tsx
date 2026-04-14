'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Team, Player } from '@/types';
import { Users, Plus, Trash2, ChevronLeft, Upload, Search } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ManageTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', slug: '', description: '', logo_url: '' });
  const supabase = getSupabase();

  useEffect(() => {
    const fetchData = async () => {
      const [tRes, pRes] = await Promise.all([
        supabase.from('teams').select('*').order('name'),
        supabase.from('players').select('*').order('display_name')
      ]);
      if (tRes.data) setTeams(tRes.data);
      if (pRes.data) setPlayers(pRes.data);
      setLoading(false);
    };
    fetchData();
  }, [supabase]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('teams')
        .insert(newTeam)
        .select()
        .single();
      
      if (error) throw error;
      setTeams([...teams, data]);
      setNewTeam({ name: '', slug: '', description: '', logo_url: '' });
      toast.success('Team created successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create team');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;
    try {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;
      setTeams(teams.filter(t => t.id !== id));
      toast.success('Team deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete team');
    }
  };

  const handleAssignTeam = async (playerId: string, teamId: string | null) => {
    try {
      const { error } = await supabase
        .from('players')
        .update({ team_id: teamId })
        .eq('id', playerId);
      
      if (error) throw error;
      setPlayers(players.map(p => p.id === playerId ? { ...p, team_id: teamId || undefined } : p));
      toast.success('Player team updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update player team');
    }
  };

  const [playerSearch, setPlayerSearch] = useState('');
  const filteredPlayers = players.filter(p => 
    p.display_name.toLowerCase().includes(playerSearch.toLowerCase()) ||
    p.username.toLowerCase().includes(playerSearch.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Link href="/operations" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white mb-8 transition-colors">
        <ChevronLeft size={14} /> Back to Operations
      </Link>

      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter italic">
            Manage <span className="text-primary">Teams</span>
          </h1>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">
            Create organizations and assign players
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Create Team Form */}
        <div className="space-y-6">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground px-2">Create New Team</h2>
          <form onSubmit={handleCreateTeam} className="bg-card border border-border rounded-3xl p-8 space-y-4 shadow-2xl">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Team Name</label>
              <input
                type="text"
                required
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                placeholder="e.g. Team Liquid"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Slug</label>
              <input
                type="text"
                required
                value={newTeam.slug}
                onChange={(e) => setNewTeam({ ...newTeam, slug: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                placeholder="e.g. team-liquid"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Logo URL</label>
              <input
                type="text"
                value={newTeam.logo_url}
                onChange={(e) => setNewTeam({ ...newTeam, logo_url: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Description</label>
              <textarea
                value={newTeam.description}
                onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors min-h-[100px]"
                placeholder="Team bio..."
              />
            </div>
            <button
              type="submit"
              disabled={isCreating}
              className="w-full py-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus size={16} /> {isCreating ? 'Creating...' : 'Create Team'}
            </button>
          </form>
        </div>

        {/* Teams List & Player Assignment */}
        <div className="lg:col-span-2 space-y-12">
          <div className="space-y-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground px-2">Existing Teams</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teams.map((team) => (
                <div key={team.id} className="bg-card border border-border rounded-2xl p-6 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-secondary border border-border overflow-hidden flex items-center justify-center">
                      {team.logo_url ? (
                        <img src={team.logo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Users size={16} className="text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-black uppercase tracking-tight italic">{team.name}</div>
                      <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{team.slug}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteTeam(team.id)}
                    className="p-2 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Assign Players to Teams</h2>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <input
                  type="text"
                  placeholder="Search players..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xl">
              <div className="max-h-[500px] overflow-y-auto divide-y divide-border/50">
                {filteredPlayers.map((player) => (
                  <div key={player.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-border">
                        {player.avatar_url ? (
                          <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-secondary flex items-center justify-center"><Users size={12} className="text-primary" /></div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase tracking-tight italic">{player.display_name}</div>
                        <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">@{player.username}</div>
                      </div>
                    </div>
                    <select
                      value={player.team_id || ''}
                      onChange={(e) => handleAssignTeam(player.id, e.target.value || null)}
                      className="bg-background border border-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="">No Team</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
