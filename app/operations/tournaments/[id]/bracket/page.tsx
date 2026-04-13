'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Users, ArrowLeft, Search, Plus, Trash2, Play, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BracketManagement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tournament, setTournament] = useState<any>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [entrants, setEntrants] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const supabase = getSupabase();
  const router = useRouter();

  const fetchData = async () => {
    setLoading(true);
    const [tRes, pRes, eRes] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase.from('players').select('*').order('display_name'),
      supabase.from('tournament_entrants').select('*, players(*)').eq('tournament_id', id)
    ]);

    if (tRes.data) setTournament(tRes.data);
    if (pRes.data) setAllPlayers(pRes.data);
    if (eRes.data) setEntrants(eRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id, supabase]);

  const handleAddEntrant = async (player: any) => {
    const exists = entrants.find(e => e.player_id === player.id);
    if (exists) {
      toast.error('Player already in tournament');
      return;
    }

    const { data, error } = await supabase
      .from('tournament_entrants')
      .insert({ tournament_id: id, player_id: player.id })
      .select('*, players(*)')
      .single();

    if (error) {
      toast.error('Failed to add player');
      console.error(error);
    } else {
      setEntrants([...entrants, data]);
      toast.success('Player added');
    }
  };

  const handleRemoveEntrant = async (entrantId: string) => {
    const { error } = await supabase.from('tournament_entrants').delete().eq('id', entrantId);
    if (error) {
      toast.error('Failed to remove player');
    } else {
      setEntrants(entrants.filter(e => e.id !== entrantId));
      toast.success('Player removed');
    }
  };

  const handleSeedByRanking = async () => {
    // Sort current entrants by ranking points descending
    const sorted = [...entrants].sort((a, b) => (b.players?.ranking_points || 0) - (a.players?.ranking_points || 0));
    setEntrants(sorted);
    toast.success('Players visually sorted by ranking points. (Auto-seeding will be applied upon generation)');
  };

  const handleDeleteTournament = async () => {
    if (!window.confirm(`Delete "${tournament?.name}"? This will remove all entrants, matches, and bracket data. This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tournaments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete tournament');
      }
      toast.success('Tournament deleted');
      router.push('/operations');
    } catch (err: any) {
      toast.error(err.message);
      setDeleting(false);
    }
  };

  const handleGenerateBracket = async () => {
    if (entrants.length < 2) return toast.error('Need at least 2 players to generate a bracket.');
    setGenerating(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/generate`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate bracket');
      }
      toast.success('Bracket generated successfully!');
      window.location.href = `/tournaments/${id}/bracket`;
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const filteredPlayers = allPlayers.filter(p =>
    p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="p-12 text-center text-muted-foreground font-bold uppercase tracking-widest text-xs animate-pulse">Loading Bracket Manager...</div>;
  if (!tournament) return <div className="p-12 text-center text-muted-foreground font-bold uppercase tracking-widest text-xs">Tournament not found</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link href="/operations" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors mb-8">
        <ArrowLeft size={14} /> Back to Operations
      </Link>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">{tournament.name}</h1>
          <p className="text-sm text-muted-foreground">Manage Entrants and Generate Bracket</p>
        </div>
        <div className="flex gap-4">
          <Link href={`/operations/tournaments/${id}/edit`} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2">
            <Pencil size={14} /> Edit
          </Link>
          <button onClick={handleDeleteTournament} disabled={deleting} className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 disabled:opacity-50">
            <Trash2 size={14} /> {deleting ? 'Deleting...' : 'Delete'}
          </button>
          <button onClick={handleSeedByRanking} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
            Seed by Ranking
          </button>
          <button onClick={handleGenerateBracket} disabled={generating} className="px-6 py-3 bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50">
            <Play size={14} /> {generating ? 'Generating...' : 'Generate Bracket'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Player Search */}
        <div className="bg-card border border-border rounded-[2rem] p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Search className="text-primary" size={16} />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight italic">Add Players</h2>
          </div>
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search players by name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 pl-12 text-sm font-bold focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredPlayers.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-primary/30 transition-colors">
                <div>
                  <div className="text-xs font-black uppercase tracking-tight italic">{p.display_name}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">@{p.username} • {p.ranking_points} pts</div>
                </div>
                <button
                  onClick={() => handleAddEntrant(p)}
                  className="w-8 h-8 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg flex items-center justify-center transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Entrants List */}
        <div className="bg-card border border-border rounded-[2rem] p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <Users className="text-amber-500" size={16} />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight italic">Current Entrants ({entrants.length})</h2>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {entrants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-2xl bg-white/5">
                <Users className="text-muted-foreground opacity-20 mb-4" size={48} />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No players added yet</p>
              </div>
            ) : (
              entrants.map((e, index) => (
                <div key={e.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-black text-muted-foreground w-4 text-right">{index + 1}.</span>
                    <div>
                      <div className="text-xs font-black uppercase tracking-tight italic">{e.players?.display_name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest">@{e.players?.username} • {e.players?.ranking_points} pts</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveEntrant(e.id)}
                    className="p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}