'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Tournament, Match, Player } from '@/types';
import { 
  Trophy, RefreshCw, User, ExternalLink, 
  ChevronLeft, ArrowDownCircle, ArrowUpCircle,
  CheckCircle, Trash2, Users, MapPin
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function TournamentDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [referees, setReferees] = useState<Player[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncOutLoading, setSyncOutLoading] = useState(false);
  const [refreshingMatches, setRefreshingMatches] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'assignments' | 'history' | 'courts'>('assignments');
  const [newCourtName, setNewCourtName] = useState('');

  const supabase = getSupabase();

  const fetchMatches = async () => {
    const { data: raw, error } = await (supabase as any)
      .from('matches')
      .select(`*, match_players (*)`)
      .eq('tournament_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching matches:', error);
      return [];
    }

    const playerIds = new Set<string>();
    (raw || []).forEach((m: any) => {
      (m.match_players || []).forEach((mp: any) => {
        if (mp.player_id) playerIds.add(mp.player_id);
      });
    });

    let playersMap: Record<string, any> = {};
    const validPlayerIds = Array.from(playerIds).filter(Boolean);
    if (validPlayerIds.length > 0) {
      const { data: playersData } = await supabase
        .from('players')
        .select('id, display_name, avatar_url')
        .in('id', validPlayerIds);
      
      playersData?.forEach(p => {
        playersMap[p.id] = p;
      });
    }

    return (raw || []).map((m: any) => ({
      ...m,
      match_players: (m.match_players || []).map((mp: any) => ({
        ...mp,
        players: playersMap[mp.player_id] || null,
      })),
    }));
  };

  const fetchData = async () => {
    setLoading(true);
    const [tRes, pRes, cRes, mRes] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase.from('players').select('*'),
      (supabase as any).from('courts').select('*').eq('tournament_id', id),
      fetchMatches()
    ]);

    if (tRes.data) setTournament(tRes.data);
    if (pRes.data) setReferees(pRes.data);
    if (cRes.data) setCourts(cRes.data);
    setMatches(mRes);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Real-time: refresh when any match or participant data changes
    const channel = supabase
      .channel(`tournament-updates-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${id}` }, async () => {
        setMatches(await fetchMatches());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players' }, async () => {
        // We can't filter match_players by tournament_id directly in the channel filter easily without a join
        // so we refresh whenever any match_player changes (could be optimized later)
        setMatches(await fetchMatches());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_entrants', filter: `tournament_id=eq.${id}` }, async () => {
        setMatches(await fetchMatches());
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [id, supabase]);

  const handleSyncIn = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch('/api/challonge/sync-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: id })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(result.message);
      const mRes = await fetchMatches();
      setMatches(mRes);
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync results');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSyncOut = async () => {
    setSyncOutLoading(true);
    try {
      const res = await fetch('/api/challonge/sync-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: id })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(result.message);
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync out');
    } finally {
      setSyncOutLoading(false);
    }
  };

  const toggleStatus = async () => {
    if (!tournament) return;
    const newStatus = tournament.status === 'active' ? 'pending' : 'active';
    setStatusLoading(true);
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
      setTournament({ ...tournament, status: newStatus });
      toast.success(`Tournament marked as ${newStatus}`);
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message}`);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleAssignRef = async (matchId: string, refId: string) => {
    const refValue = refId || null;
    const { error } = await (supabase as any)
      .from('matches')
      .update({
        ref_id: refValue,
        status: refValue ? 'grabbed' : 'pending',
      })
      .eq('id', matchId);

    if (error) {
      toast.error(`Failed to assign referee: ${error.message}`);
    } else {
      toast.success(refValue ? 'Referee assigned' : 'Referee unassigned');
      if (refValue) {
        await (supabase as any).from('notifications').insert({
          player_id: refValue,
          type: 'ref_assigned',
          message: `You have been assigned a match in ${tournament?.name}!`,
          link: `/referee`
        });
      }
      setMatches(await fetchMatches());
    }
  };

  const handleCreateCourt = async () => {
    if (!newCourtName) return;
    const { error } = await (supabase as any).from('courts').insert({
      name: newCourtName,
      tournament_id: id
    });

    if (error) toast.error('Failed to create court');
    else {
      toast.success('Court created');
      setNewCourtName('');
      const { data } = await (supabase as any).from('courts').select('*').eq('tournament_id', id);
      setCourts(data || []);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><RefreshCw className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <Link href="/operations" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white mb-8 transition-colors">
        <ChevronLeft size={14} /> Back to Operations
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Trophy className="text-primary" size={24} />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">
              {tournament?.name} <span className="text-primary">Dashboard</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleStatus}
              disabled={statusLoading}
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${
                tournament?.status === 'active' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
              }`}
            >
              {statusLoading ? <RefreshCw size={10} className="animate-spin" /> : tournament?.status}
            </button>
            <span className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
              {new Date(tournament?.held_at || '').toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSyncIn}
            disabled={syncLoading}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
          >
            <ArrowDownCircle size={14} className={syncLoading ? 'animate-spin' : ''} />
            Sync In
          </button>
          <button
            onClick={handleSyncOut}
            disabled={syncOutLoading}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
          >
            <ArrowUpCircle size={14} className={syncOutLoading ? 'animate-spin' : ''} />
            Sync Out
          </button>
          <Link
            href={`/operations/tournaments/${id}/entrants`}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
          >
            <Users size={14} /> Manage Entrants
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Tabs */}
        <div className="space-y-2">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'assignments' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-card border border-border text-muted-foreground hover:text-white'
            }`}
          >
            <Trophy size={16} /> Live Assignments
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'history' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-card border border-border text-muted-foreground hover:text-white'
            }`}
          >
            <CheckCircle size={16} /> Match History
          </button>
          <button
            onClick={() => setActiveTab('courts')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'courts' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-card border border-border text-muted-foreground hover:text-white'
            }`}
          >
            <MapPin size={16} /> Court Management
          </button>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3">
          {activeTab === 'assignments' || activeTab === 'history' ? (
            <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-black uppercase tracking-tight italic">
                  {activeTab === 'assignments' ? 'Live Queue' : 'Completed Matches'}
                </h2>
                <button 
                  onClick={async () => {
                    setRefreshingMatches(true);
                    setMatches(await fetchMatches());
                    setRefreshingMatches(false);
                    toast.success('Matches refreshed');
                  }}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                >
                  <RefreshCw size={18} className={refreshingMatches ? 'animate-spin' : ''} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-white/5">
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Matchup</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Referee</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.filter(m => activeTab === 'assignments' ? m.status !== 'submitted' : m.status === 'submitted').length > 0 ? (
                      matches.filter(m => activeTab === 'assignments' ? m.status !== 'submitted' : m.status === 'submitted').map((match) => (
                        <tr key={match.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-black uppercase tracking-tight italic">{(match as any).match_players?.[0]?.players?.display_name || 'TBD'}</span>
                              <span className="text-primary font-black italic">VS</span>
                              <span className="text-xs font-black uppercase tracking-tight italic">{(match as any).match_players?.[1]?.players?.display_name || 'TBD'}</span>
                            </div>
                            <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{(match as any).stage}</div>
                          </td>
                          <td className="px-8 py-6">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                              match.status === 'pending' ? 'bg-slate-500/10 text-slate-500' :
                              match.status === 'in_progress' ? 'bg-amber-500/10 text-amber-500' :
                              match.status === 'submitted' ? 'bg-green-500/10 text-green-500' :
                              'bg-primary/10 text-primary'
                            }`}>
                              {match.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <select
                              value={(match as any).ref_id || ''}
                              onChange={(e) => handleAssignRef(match.id, e.target.value)}
                              className="bg-transparent text-[10px] font-bold uppercase tracking-widest text-muted-foreground focus:outline-none focus:text-primary transition-colors"
                            >
                              <option value="">Unassigned</option>
                              {referees.map(ref => (
                                <option key={ref.id} value={ref.id}>{ref.display_name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <Link href={`/scorer/${match.id}`} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors inline-block">
                              <ExternalLink size={14} />
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-8 py-20 text-center text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                          No matches in this category
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl">
                <h2 className="text-xl font-black uppercase tracking-tight italic mb-6">Add New Court</h2>
                <div className="flex gap-4">
                  <input
                    type="text"
                    placeholder="Court Name (e.g. Stadium 1)"
                    value={newCourtName}
                    onChange={(e) => setNewCourtName(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-primary transition-colors"
                  />
                  <button
                    onClick={handleCreateCourt}
                    className="px-8 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                  >
                    Add Court
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {courts.map((court) => (
                  <div key={court.id} className="p-6 bg-card border border-border rounded-2xl flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <MapPin className="text-primary" size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-black uppercase tracking-tight italic">{court.name}</div>
                        <div className={`text-[8px] font-black uppercase tracking-widest ${court.current_match_id ? 'text-amber-500' : 'text-green-500'}`}>
                          {court.current_match_id ? 'Occupied' : 'Available'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('Delete court?')) return;
                        await supabase.from('courts').delete().eq('id', court.id);
                        setCourts(courts.filter(c => c.id !== court.id));
                        toast.success('Court deleted');
                      }}
                      className="p-2 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
