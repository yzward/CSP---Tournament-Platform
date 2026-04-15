'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Player, Tournament } from '@/types';
import { ChevronLeft, Search, Plus, Trash2, Users, RefreshCw, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function ManageEntrantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [entrants, setEntrants] = useState<any[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [isCreatingPlayer, setIsCreatingPlayer] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ display_name: '', username: '', region: 'Global' });
  const [selectedEntrants, setSelectedEntrants] = useState<Set<string>>(new Set());
  const [isDeletingMass, setIsDeletingMass] = useState(false);
  const supabase = getSupabase();

  useEffect(() => {
    const fetchData = async () => {
      const [tRes, eRes, pRes] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', id).single(),
        supabase.from('tournament_entrants').select('*, players(*)').eq('tournament_id', id),
        supabase.from('players').select('*').order('display_name')
      ]);

      if (tRes.data) setTournament(tRes.data);
      if (eRes.data) setEntrants(eRes.data);
      if (pRes.data) setAllPlayers(pRes.data);
      setLoading(false);
    };

    fetchData();
  }, [id, supabase]);

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingPlayer(true);
    try {
      // Generate a placeholder discord_id for unclaimed accounts
      const unclaimedId = `unclaimed_${Math.random().toString(36).substring(2, 11)}`;
      
      const { data: player, error: pError } = await supabase
        .from('players')
        .insert({
          ...newPlayer,
          discord_id: unclaimedId,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newPlayer.username}`,
          ranking_points: 0,
          club: 'None'
        })
        .select()
        .single();
      
      if (pError) throw pError;
      
      // Add to allPlayers list
      setAllPlayers([...allPlayers, player]);
      
      // Automatically add to tournament
      await handleAddPlayer(player);
      
      setNewPlayer({ display_name: '', username: '', region: 'Global' });
      toast.success('New player created and added to tournament');
    } catch (err: any) {
      console.error('Error creating player:', err);
      toast.error(`Failed to create player: ${err.message}`);
    } finally {
      setIsCreatingPlayer(false);
    }
  };

  const handleAddPlayer = async (player: Player) => {
    if (entrants.some(e => e.player_id === player.id)) {
      toast.error('Player already added');
      return;
    }

    const { data, error } = await supabase
      .from('tournament_entrants')
      .insert({
        tournament_id: id,
        player_id: player.id,
        status: 'registered'
      })
      .select('*, players(*)');

    if (error) {
      console.error('Error adding player to tournament:', error);
      if (error.message.includes('column "status" of relation "tournament_entrants" does not exist')) {
        toast.error('Database update required. Please run the migration SQL in your Supabase dashboard.');
      } else {
        toast.error(`Failed to add player: ${error.message}`);
      }
    } else if (data && data.length > 0) {
      setEntrants([...entrants, data[0]]);
      toast.success(`${player.display_name} added to tournament`);
    }
  };

  const handleRemovePlayer = async (entrantId: string) => {
    const { error } = await supabase
      .from('tournament_entrants')
      .delete()
      .eq('id', entrantId);

    if (error) {
      toast.error('Failed to remove player');
    } else {
      setEntrants(entrants.filter(e => e.id !== entrantId));
      toast.success('Player removed');
    }
  };

  const handleSeedByRank = async () => {
    setSeeding(true);
    try {
      // Sort entrants by player ranking points descending
      const sortedEntrants = [...entrants].sort((a, b) => 
        (b.players?.ranking_points || 0) - (a.players?.ranking_points || 0)
      );

      // Update seeds in database
      const updates = sortedEntrants.map((entrant, index) => ({
        id: entrant.id,
        seed: index + 1
      }));

      // Use a single update if possible, but Supabase doesn't easily support bulk update with different values per row without a custom function
      // So we'll do it in a loop for now, or better, use a RPC if we had one.
      // Since we are in a loop, let's at least try to be efficient.
      for (const update of updates) {
        const { error } = await supabase
          .from('tournament_entrants')
          .update({ seed: update.seed })
          .eq('id', update.id);
        if (error) throw error;
      }

      // Refresh entrants
      const { data } = await supabase.from('tournament_entrants').select('*, players(*)').eq('tournament_id', id);
      if (data) setEntrants(data);
      
      toast.success('Entrants seeded by rank successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to seed');
    } finally {
      setSeeding(false);
    }
  };

  const filteredPlayers = allPlayers.filter(p => 
    p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.username.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 10);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><RefreshCw className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Link href="/operations" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white mb-8 transition-colors">
        <ChevronLeft size={14} /> Back to Operations
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Users className="text-primary" size={20} />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">
              Manage <span className="text-primary">Entrants</span>
            </h1>
          </div>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">
            Tournament: <span className="text-white">{tournament?.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          {selectedEntrants.size > 0 && (
            <button
              onClick={async () => {
                if (!window.confirm(`Delete ${selectedEntrants.size} selected entrants?`)) return;
                setIsDeletingMass(true);
                try {
                  const { error } = await supabase
                    .from('tournament_entrants')
                    .delete()
                    .in('id', Array.from(selectedEntrants));
                  if (error) throw error;
                  setEntrants(entrants.filter(e => !selectedEntrants.has(e.id)));
                  setSelectedEntrants(new Set());
                  toast.success(`Deleted ${selectedEntrants.size} entrants`);
                } catch (err: any) {
                  toast.error(`Failed to delete: ${err.message}`);
                } finally {
                  setIsDeletingMass(false);
                }
              }}
              disabled={isDeletingMass}
              className="flex items-center gap-2 px-6 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95 disabled:opacity-50"
            >
              <Trash2 size={14} />
              Delete Selected ({selectedEntrants.size})
            </button>
          )}
          <button
            onClick={handleSeedByRank}
            disabled={seeding || entrants.length === 0}
            className="flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50"
          >
            {seeding ? <RefreshCw size={14} className="animate-spin" /> : <Trophy size={14} />}
            Seed by Rank
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left: Current Entrants */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Current Entrants ({entrants.length})</h2>
            {entrants.length > 0 && (
              <button 
                onClick={() => {
                  if (selectedEntrants.size === entrants.length) {
                    setSelectedEntrants(new Set());
                  } else {
                    setSelectedEntrants(new Set(entrants.map(e => e.id)));
                  }
                }}
                className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
              >
                {selectedEntrants.size === entrants.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
          
          <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="max-h-[600px] overflow-y-auto">
              {entrants.length > 0 ? (
                <div className="divide-y divide-border/50">
                    {entrants.sort((a, b) => (a.seed || 999) - (b.seed || 999)).map((entrant) => (
                      <div 
                        key={entrant.id} 
                        onClick={() => {
                          const next = new Set(selectedEntrants);
                          if (next.has(entrant.id)) next.delete(entrant.id);
                          else next.add(entrant.id);
                          setSelectedEntrants(next);
                        }}
                        className={`p-6 flex items-center justify-between hover:bg-white/5 transition-colors group cursor-pointer ${selectedEntrants.has(entrant.id) ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedEntrants.has(entrant.id) ? 'bg-primary border-primary' : 'border-border'}`}>
                              {selectedEntrants.has(entrant.id) && <Plus size={10} className="text-white rotate-45" />}
                            </div>
                            <div className="w-6 text-center">
                              <span className="text-[10px] font-black text-primary italic">#{entrant.seed || '-'}</span>
                            </div>
                          </div>
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center">
                          {entrant.players?.avatar_url ? (
                            <img src={entrant.players.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Users size={16} className="text-primary" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-black uppercase tracking-tight italic">{entrant.players?.display_name}</div>
                            <span className={`text-[6px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                              (!entrant.players?.discord_id || entrant.players?.discord_id.startsWith('unclaimed_') || entrant.players?.discord_id.includes('@') || entrant.players?.discord_id.length < 30)
                                ? 'bg-slate-500/10 text-slate-500' 
                                : 'bg-green-500/10 text-green-500'
                            }`}>
                              {(!entrant.players?.discord_id || entrant.players?.discord_id.startsWith('unclaimed_') || entrant.players?.discord_id.includes('@') || entrant.players?.discord_id.length < 30) ? 'Unclaimed' : 'Claimed'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                              {entrant.players?.username}
                            </span>
                            {entrant.startgg_entrant_id && (
                              <span className="text-[7px] font-black text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-sm">
                                <Trophy size={8} /> Synced to Challonge
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemovePlayer(entrant.id)}
                        className="p-3 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-20 text-center">
                  <Users size={40} className="mx-auto text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No entrants yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Add Players & Quick Create */}
        <div className="space-y-12">
          {/* Add from Database */}
          <div className="space-y-6">
            <div className="px-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Add from Database</h2>
            </div>

            <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl space-y-8">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={18} className="text-muted-foreground" />
                </div>
                <input
                  type="text"
                  placeholder="Search players by name or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-background border border-border rounded-2xl pl-12 pr-4 py-4 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="space-y-3">
                {searchQuery ? (
                  filteredPlayers.length > 0 ? (
                    filteredPlayers.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => handleAddPlayer(player)}
                        disabled={entrants.some(e => e.player_id === player.id)}
                        className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex items-center justify-between transition-all group disabled:opacity-50 disabled:hover:bg-white/5"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center">
                            {player.avatar_url ? (
                              <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Users size={12} className="text-primary" />
                            )}
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <div className="text-xs font-black uppercase tracking-tight italic">{player.display_name}</div>
                              <span className={`text-[6px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                                (!player.discord_id || player.discord_id.startsWith('unclaimed_') || player.discord_id.includes('@') || player.discord_id.length < 30)
                                  ? 'bg-slate-500/10 text-slate-500' 
                                  : 'bg-green-500/10 text-green-500'
                              }`}>
                                {(!player.discord_id || player.discord_id.startsWith('unclaimed_') || player.discord_id.includes('@') || player.discord_id.length < 30) ? 'Unclaimed' : 'Claimed'}
                              </span>
                            </div>
                            <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{player.username}</div>
                          </div>
                        </div>
                        <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-all">
                          <Plus size={14} />
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-center py-8 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">No players found</p>
                  )
                ) : (
                  <div className="space-y-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground px-2">Top Ranked Players</p>
                    {allPlayers.slice(0, 10).map((player) => (
                      <button
                        key={player.id}
                        onClick={() => handleAddPlayer(player)}
                        disabled={entrants.some(e => e.player_id === player.id)}
                        className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex items-center justify-between transition-all group disabled:opacity-50 disabled:hover:bg-white/5"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center">
                            {player.avatar_url ? (
                              <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Users size={12} className="text-primary" />
                            )}
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <div className="text-xs font-black uppercase tracking-tight italic">{player.display_name}</div>
                              <span className={`text-[6px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                                (!player.discord_id || player.discord_id.startsWith('unclaimed_') || player.discord_id.includes('@') || player.discord_id.length < 30)
                                  ? 'bg-slate-500/10 text-slate-500' 
                                  : 'bg-green-500/10 text-green-500'
                              }`}>
                                {(!player.discord_id || player.discord_id.startsWith('unclaimed_') || player.discord_id.includes('@') || player.discord_id.length < 30) ? 'Unclaimed' : 'Claimed'}
                              </span>
                            </div>
                            <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{player.username}</div>
                          </div>
                        </div>
                        <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-all">
                          <Plus size={14} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Create Player */}
          <div className="space-y-6">
            <div className="px-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Quick Create Player</h2>
            </div>
            <form onSubmit={handleCreatePlayer} className="bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Display Name</label>
                  <input
                    type="text"
                    required
                    value={newPlayer.display_name}
                    onChange={(e) => setNewPlayer({ ...newPlayer, display_name: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Username</label>
                  <input
                    type="text"
                    required
                    value={newPlayer.username}
                    onChange={(e) => setNewPlayer({ ...newPlayer, username: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                    placeholder="e.g. johndoe"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Region</label>
                <input
                  type="text"
                  value={newPlayer.region}
                  onChange={(e) => setNewPlayer({ ...newPlayer, region: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                  placeholder="e.g. North America"
                />
              </div>
              <button
                type="submit"
                disabled={isCreatingPlayer}
                className="w-full py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCreatingPlayer ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                Create & Add to Tournament
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
