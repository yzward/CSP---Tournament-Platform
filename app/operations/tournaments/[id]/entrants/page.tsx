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
  const [syncing, setSyncing] = useState(false);
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
      .select('*, players(*)')
      .single();

    if (error) {
      toast.error('Failed to add player');
    } else {
      setEntrants([...entrants, data]);
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

  const handleSyncToStartGG = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/startgg/sync-entrants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: id })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(result.message);
      
      // Refresh entrants to get startgg_entrant_id
      const { data } = await supabase.from('tournament_entrants').select('*, players(*)').eq('tournament_id', id);
      if (data) setEntrants(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync');
    } finally {
      setSyncing(false);
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

        <button
          onClick={handleSyncToStartGG}
          disabled={syncing || entrants.length === 0}
          className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
        >
          {syncing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Sync All to start.gg
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left: Current Entrants */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Current Entrants ({entrants.length})</h2>
          </div>
          
          <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="max-h-[600px] overflow-y-auto">
              {entrants.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {entrants.map((entrant) => (
                    <div key={entrant.id} className="p-6 flex items-center justify-between hover:bg-white/5 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center">
                          {entrant.players?.avatar_url ? (
                            <img src={entrant.players.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Users size={16} className="text-primary" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-black uppercase tracking-tight italic">{entrant.players?.display_name}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                              {entrant.players?.username}
                            </span>
                            {entrant.startgg_entrant_id && (
                              <span className="text-[8px] font-black text-green-500 uppercase tracking-widest flex items-center gap-1">
                                <Trophy size={8} /> Synced
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

        {/* Right: Add Players */}
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
                          <div className="text-xs font-black uppercase tracking-tight italic">{player.display_name}</div>
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
                <div className="text-center py-12 space-y-4">
                  <Search size={32} className="mx-auto text-muted-foreground/20" />
                  <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Search for players to add them</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
