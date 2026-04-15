'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Users, Plus, X, Search, Save, ChevronLeft, Trash2, Edit2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function AdminTeamsPage() {
  const [teams, setTeams]                   = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam]     = useState<any>(null);
  const [roster, setRoster]                 = useState<any[]>([]);
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<any[]>([]);
  const [isSearching, setIsSearching]       = useState(false);
  const [loading, setLoading]               = useState(true);
  const [editingTeam, setEditingTeam]       = useState(false);
  const [teamForm, setTeamForm]             = useState({ name: '', slug: '', description: '' });
  const [creatingTeam, setCreatingTeam]     = useState(false);
  const supabase = getSupabase();

  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select('*').order('name');
    setTeams(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTeams(); }, []);

  const fetchRoster = async (teamId: string) => {
    const { data } = await supabase
      .from('players')
      .select('id, display_name, username, avatar_url, discord_id, ranking_points, club')
      .eq('team_id', teamId)
      .order('ranking_points', { ascending: false });
    setRoster(data || []);
  };

  const selectTeam = async (team: any) => {
    setSelectedTeam(team);
    setSearchQuery('');
    setSearchResults([]);
    await fetchRoster(team.id);
  };

  const searchPlayers = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    const { data } = await supabase
      .from('players')
      .select('id, display_name, username, avatar_url, discord_id, ranking_points, team_id, club')
      .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
      .limit(10);
    // Exclude players already on this team
    setSearchResults((data || []).filter(p => p.team_id !== selectedTeam?.id));
    setIsSearching(false);
  };

  const addToRoster = async (player: any) => {
    const { error } = await supabase
      .from('players')
      .update({ team_id: selectedTeam.id })
      .eq('id', player.id);
    if (error) { toast.error('Failed to add player'); return; }
    toast.success(`${player.display_name} added to ${selectedTeam.name}`);
    setSearchResults(r => r.filter(p => p.id !== player.id));
    await fetchRoster(selectedTeam.id);
  };

  const removeFromRoster = async (player: any) => {
    const { error } = await supabase
      .from('players')
      .update({ team_id: null })
      .eq('id', player.id);
    if (error) { toast.error('Failed to remove player'); return; }
    toast.success(`${player.display_name} removed from roster`);
    setRoster(r => r.filter(p => p.id !== player.id));
  };

  const saveTeam = async () => {
    if (!teamForm.name || !teamForm.slug) { toast.error('Name and slug are required'); return; }
    const slug = teamForm.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (editingTeam && selectedTeam) {
      const { error } = await supabase.from('teams').update({ name: teamForm.name, slug, description: teamForm.description }).eq('id', selectedTeam.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Team updated');
      setEditingTeam(false);
      await fetchTeams();
      setSelectedTeam({ ...selectedTeam, name: teamForm.name, slug, description: teamForm.description });
    } else {
      const { data, error } = await supabase.from('teams').insert({ name: teamForm.name, slug, description: teamForm.description }).select().single();
      if (error) { toast.error(error.message); return; }
      toast.success('Team created');
      setCreatingTeam(false);
      setTeamForm({ name: '', slug: '', description: '' });
      await fetchTeams();
      selectTeam(data);
    }
  };

  const deleteTeam = async (team: any) => {
    if (!confirm(`Delete ${team.name}? Players will become unaffiliated.`)) return;
    // Unlink all players first
    await supabase.from('players').update({ team_id: null }).eq('team_id', team.id);
    const { error } = await supabase.from('teams').delete().eq('id', team.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Team deleted');
    setSelectedTeam(null);
    await fetchTeams();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-center gap-4 mb-10">
        <Link href="/admin" className="p-2 bg-card border border-border rounded-xl hover:border-primary transition-colors">
          <ChevronLeft size={16} />
        </Link>
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter italic">
            Manage <span className="text-primary">Teams</span>
          </h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Create teams and manage rosters — including unclaimed players
          </p>
        </div>
        <button
          onClick={() => { setCreatingTeam(true); setSelectedTeam(null); setTeamForm({ name: '', slug: '', description: '' }); }}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all"
        >
          <Plus size={14} /> New Team
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Team list */}
        <div className="bg-card border border-border rounded-[2rem] p-4 space-y-2 h-fit">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 pb-2">Teams</p>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />)
          ) : teams.map(team => (
            <button
              key={team.id}
              onClick={() => selectTeam(team)}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-between group ${
                selectedTeam?.id === team.id ? 'bg-primary text-white' : 'hover:bg-white/5 text-muted-foreground hover:text-white'
              }`}
            >
              <span className="truncate">{team.name}</span>
              <button
                onClick={e => { e.stopPropagation(); deleteTeam(team); }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </button>
          ))}
          {!loading && teams.length === 0 && (
            <p className="text-[10px] text-muted-foreground/50 text-center py-4">No teams yet</p>
          )}
        </div>

        {/* Team editor / roster */}
        <div className="md:col-span-2 space-y-4">

          {/* Create team form */}
          {creatingTeam && (
            <div className="bg-card border border-primary/30 rounded-[2rem] p-6 space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest">Create New Team</h2>
              <input placeholder="Team name" value={teamForm.name}
                onChange={e => setTeamForm(f => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }))}
                className="w-full bg-white/5 border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary" />
              <input placeholder="Slug (auto-generated)" value={teamForm.slug}
                onChange={e => setTeamForm(f => ({ ...f, slug: e.target.value }))}
                className="w-full bg-white/5 border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary" />
              <textarea placeholder="Description (optional)" value={teamForm.description}
                onChange={e => setTeamForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-white/5 border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary resize-none h-20" />
              <div className="flex gap-3">
                <button onClick={saveTeam} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all">
                  <Save size={14} /> Save
                </button>
                <button onClick={() => setCreatingTeam(false)} className="px-4 py-2 bg-white/5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {selectedTeam && !creatingTeam && (
            <>
              {/* Team header */}
              <div className="bg-card border border-border rounded-[2rem] p-6">
                {editingTeam ? (
                  <div className="space-y-3">
                    <input placeholder="Team name" value={teamForm.name}
                      onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:border-primary" />
                    <input placeholder="Slug" value={teamForm.slug}
                      onChange={e => setTeamForm(f => ({ ...f, slug: e.target.value }))}
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:border-primary" />
                    <textarea placeholder="Description" value={teamForm.description}
                      onChange={e => setTeamForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:border-primary resize-none h-16" />
                    <div className="flex gap-2">
                      <button onClick={saveTeam} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-black uppercase tracking-widest"><Check size={12} /> Save</button>
                      <button onClick={() => setEditingTeam(false)} className="px-3 py-1.5 bg-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter italic">{selectedTeam.name}</h2>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">/{selectedTeam.slug}</p>
                      {selectedTeam.description && <p className="text-xs text-muted-foreground mt-2">{selectedTeam.description}</p>}
                    </div>
                    <button onClick={() => { setEditingTeam(true); setTeamForm({ name: selectedTeam.name, slug: selectedTeam.slug, description: selectedTeam.description || '' }); }}
                      className="p-2 bg-white/5 rounded-lg hover:border-primary border border-border transition-colors">
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Add player search */}
              <div className="bg-card border border-border rounded-[2rem] p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Add Player to Roster</p>
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <input
                    type="text"
                    placeholder="Search by name or username (claimed or unclaimed)..."
                    value={searchQuery}
                    onChange={e => searchPlayers(e.target.value)}
                    className="w-full bg-white/5 border border-border rounded-xl pl-10 pr-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-all"
                  />
                </div>
                <AnimatePresence>
                  {searchResults.map(player => (
                    <motion.div key={player.id} initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary border border-border overflow-hidden flex items-center justify-center shrink-0">
                          {player.avatar_url ? <img src={player.avatar_url} className="w-full h-full object-cover" /> : <Users size={14} className="text-primary" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black uppercase tracking-tight">{player.display_name}</span>
                            {player.discord_id
                              ? <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Claimed" />
                              : <span className="w-1.5 h-1.5 rounded-full border border-muted-foreground/40" title="Unclaimed" />}
                          </div>
                          <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest">
                            @{player.username}{player.team_id ? ' · On another team' : ''}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => addToRoster(player)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all">
                        <Plus size={10} /> Add
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isSearching && <p className="text-[10px] text-muted-foreground text-center py-2">Searching...</p>}
              </div>

              {/* Current roster */}
              <div className="bg-card border border-border rounded-[2rem] p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
                  Current Roster — {roster.length} player{roster.length !== 1 ? 's' : ''}
                </p>
                {roster.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/50 text-center py-8">No players on this roster yet</p>
                ) : roster.map(player => (
                  <div key={player.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary border border-border overflow-hidden flex items-center justify-center shrink-0">
                        {player.avatar_url ? <img src={player.avatar_url} className="w-full h-full object-cover" /> : <Users size={14} className="text-primary" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black uppercase tracking-tight">{player.display_name}</span>
                          {player.discord_id
                            ? <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Claimed" />
                            : <span className="w-1.5 h-1.5 rounded-full border border-muted-foreground/40" title="Unclaimed — profile not yet linked" />}
                        </div>
                        <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest">
                          @{player.username} · {player.ranking_points} pts
                        </span>
                      </div>
                    </div>
                    <button onClick={() => removeFromRoster(player)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-red-400 transition-all">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {!selectedTeam && !creatingTeam && (
            <div className="bg-card border border-dashed border-border rounded-[2rem] p-12 text-center">
              <Users size={40} className="mx-auto text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Select a team to manage its roster</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
