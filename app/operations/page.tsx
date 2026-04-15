'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Tournament, Match, Player } from '@/types';
import { Shield, RefreshCw, Users, Trophy, Plus, Settings, User, CheckCircle, XCircle, ExternalLink, MapPin, ListOrdered, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function OperationsDashboard() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [referees, setReferees] = useState<Player[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCourtName, setNewCourtName] = useState('');
  const [selectedTournament, setSelectedTournament] = useState('');
  const supabase = getSupabase();

  const fetchMatches = async () => {
    const { data: raw, error } = await (supabase as any)
      .from('matches')
      .select(`*, match_players (*)`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching matches:', error);
      return [];
    }

    // Fetch players manually to avoid PostgREST nested join issues
    const playerIds = new Set<string>();
    (raw || []).forEach((m: any) => {
      (m.match_players || []).forEach((mp: any) => playerIds.add(mp.player_id));
    });

    let playersMap: Record<string, any> = {};
    if (playerIds.size > 0) {
      const { data: playersData } = await supabase
        .from('players')
        .select('id, display_name, avatar_url')
        .in('id', Array.from(playerIds));
      
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

  useEffect(() => {
    const fetchData = async () => {
      const [tournamentsRes, allPlayersRes, courtsRes, enrichedMatches] = await Promise.all([
        supabase.from('tournaments').select('*').order('held_at', { ascending: false }),
        supabase.from('players').select('*'),
        (supabase as any).from('courts').select('*, tournaments(name)'),
        fetchMatches(),
      ]);

      setTournaments(tournamentsRes.data || []);
      setMatches(enrichedMatches);
      setReferees(allPlayersRes.data || []);
      setCourts(courtsRes.data || []);
      if (tournamentsRes.data?.[0]) setSelectedTournament((tournamentsRes.data[0] as any).id);
      setLoading(false);
    };

    fetchData();
  }, [supabase]);

  const handleCreateCourt = async () => {
    if (!newCourtName || !selectedTournament) return;
    const { error } = await (supabase as any).from('courts').insert({
      name: newCourtName,
      tournament_id: selectedTournament
    });

    if (error) toast.error('Failed to create court');
    else {
      toast.success('Court created');
      setNewCourtName('');
      const { data } = await (supabase as any).from('courts').select('*, tournaments(name)');
      setCourts(data || []);
    }
  };

  const handleDeleteTournament = async (tournamentId: string) => {
    if (!confirm('Are you sure you want to delete this tournament? This action cannot be undone.')) return;
    
    const { error } = await supabase.from('tournaments').delete().eq('id', tournamentId);
    if (error) {
      toast.error('Failed to delete tournament');
      console.error(error);
    } else {
      toast.success('Tournament deleted');
      setTournaments(tournaments.filter(t => t.id !== tournamentId));
      if (selectedTournament === tournamentId) {
        setSelectedTournament(tournaments.length > 1 ? tournaments.find(t => t.id !== tournamentId)?.id || '' : '');
      }
    }
  };

  const handleAssignRef = async (matchId: string, refId: string) => {
    // Empty string = "Unassigned" — pass null to avoid FK constraint violation
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
          message: `You have been assigned a match! Check your dashboard.`,
          link: `/referee`
        });
      }

      setMatches(await fetchMatches());
    }
  };

  const [activeMainTab, setActiveMainTab] = useState<'assignments' | 'history'>('assignments');

  const handleReopenMatch = async (matchId: string) => {
    if (!window.confirm('Are you sure you want to reopen this match? This will reset its status to in_progress.')) {
      return;
    }

    const { error } = await (supabase as any)
      .from('matches')
      .update({ status: 'in_progress' })
      .eq('id', matchId);

    if (error) toast.error('Failed to reopen match');
    else {
      toast.success('Match reopened');
      
      const { data: matchPlayers } = await (supabase as any)
        .from('match_players').select('player_id').eq('match_id', matchId);
      if (matchPlayers?.length) {
        await (supabase as any).from('notifications').insert(
          matchPlayers.map((mp: any) => ({
            player_id: mp.player_id,
            type: 'match_correction',
            message: 'Your match has been reopened for correction.',
            link: '/referee'
          }))
        );
      }

      setMatches(await fetchMatches());
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div>
          <h1 className="text-5xl font-black uppercase tracking-tighter italic mb-4">
            Operations <span className="text-primary">Dashboard</span>
          </h1>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">
            Manage tournaments, referees, and match assignments
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex bg-card border border-border rounded-xl p-1 mr-4">
            <button
              onClick={() => setActiveMainTab('assignments')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                activeMainTab === 'assignments' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-white'
              }`}
            >
              Assignments
            </button>
            <button
              onClick={() => setActiveMainTab('history')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                activeMainTab === 'history' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-white'
              }`}
            >
              History
            </button>
          </div>
          <Link
            href="/operations/tournaments"
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
          >
            <Plus size={14} /> Import from Challonge
          </Link>
          <Link
            href="/operations/teams"
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
          >
            <Users size={14} /> Manage Teams
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column: Tournament Control & Refs */}
        <div className="space-y-12">
          {/* Tournament Setup Guide */}
          <div className="bg-card border border-border rounded-[2rem] p-8 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Shield size={80} />
            </div>
            <div className="flex items-center gap-3 mb-8 relative z-10">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Shield className="text-primary" size={20} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight italic">Setup Guide</h2>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-black flex items-center justify-center">1</div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest mb-1">Create/Import</h3>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Start by importing an existing tournament from Challonge or creating a new one directly here.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-black flex items-center justify-center">2</div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest mb-1">Manage Entrants</h3>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Link your ranked players from the database to the tournament. This ensures stats are tracked correctly.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-black flex items-center justify-center">3</div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest mb-1">Sync to Challonge</h3>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Once your list is ready, sync to Challonge to create the entrants on their platform for bracket management.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-black flex items-center justify-center">4</div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest mb-1">Live Scoring</h3>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Use the Live Scorer to report results. They will automatically push to Challonge and update local rankings.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tournament Status & Management */}
          <div className="bg-card border border-border rounded-[2rem] p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Trophy className="text-primary" size={20} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight italic">Tournaments</h2>
            </div>

            <div className="space-y-4">
              {tournaments.slice(0, 3).map((t) => (
                <div key={t.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-black uppercase tracking-tight italic truncate max-w-[180px]">{t.name}</span>
                      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{new Date(t.held_at).toLocaleDateString()}</span>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                      t.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-500'
                    }`}>
                      {t.status}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href={`/operations/tournaments/${t.id}/entrants`}
                      className="py-2.5 bg-primary/10 hover:bg-primary/20 text-primary text-[8px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <Users size={10} /> Entrants
                    </Link>
                    <a
                      href={t.evaroon_id?.startsWith('http') ? t.evaroon_id : `https://challonge.com/${t.evaroon_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-[8px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 border border-white/5"
                    >
                      <ExternalLink size={10} /> Challonge
                    </a>
                  </div>

                  {t.status === 'active' && (
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        disabled={loading}
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const res = await fetch('/api/challonge/sync-tournament', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ tournamentId: t.id })
                            });
                            const result = await res.json();
                            if (!res.ok) throw new Error(result.error);
                            toast.success(result.message);
                            const enrichedMatches = await fetchMatches();
                            setMatches(enrichedMatches);
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to sync results');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
                        {loading ? 'Syncing...' : 'Sync In'}
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t border-white/5">
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Delete "${t.name}"?`)) return;
                        try {
                          const res = await fetch(`/api/tournaments/${t.id}`, { method: 'DELETE' });
                          if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
                          toast.success('Tournament deleted');
                          setTournaments(tournaments.filter(item => item.id !== t.id));
                        } catch (err: any) {
                          toast.error(err.message || 'Failed to delete tournament');
                        }
                      }}
                      className="flex-1 py-2 text-red-500/50 hover:text-red-500 text-[8px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1"
                    >
                      <Trash2 size={10} /> Delete
                    </button>
                    {t.status === 'active' && (
                      <button
                        onClick={async () => {
                          if (!window.confirm('Complete tournament?')) return;
                          try {
                            const { data: entrantsData } = await supabase
                              .from('tournament_entrants')
                              .select('player_id, placement')
                              .eq('tournament_id', t.id);
                            const placements = (entrantsData || []).map((e: any, i: number) => ({
                              player_id: e.player_id,
                              placement: e.placement || (i + 1)
                            }));
                            const res = await fetch(`/api/tournaments/${t.id}`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'complete', placements })
                            });
                            const result = await res.json();
                            if (!res.ok) throw new Error(result.error);
                            toast.success('Tournament completed!');
                            setTournaments(tournaments.map(item => item.id === t.id ? { ...item, status: 'completed' } : item));
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to complete tournament');
                          }
                        }}
                        className="flex-1 py-2 text-primary/50 hover:text-primary text-[8px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1"
                      >
                        <CheckCircle size={10} /> Complete
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <Link href="/operations/tournaments" className="block text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors pt-2">
                View All Tournaments
              </Link>
            </div>
          </div>

          {/* Court Management */}
          <div className="bg-card border border-border rounded-[2rem] p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <MapPin className="text-primary" size={20} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight italic">Courts</h2>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Court Name (e.g. Stadium 1)"
                  value={newCourtName}
                  onChange={(e) => setNewCourtName(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-primary transition-colors"
                />
                <select
                  value={selectedTournament}
                  onChange={(e) => setSelectedTournament(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-primary transition-colors"
                >
                  {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button
                  onClick={handleCreateCourt}
                  className="w-full py-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  Add Court
                </button>
              </div>

              <div className="space-y-3">
                {courts.map((court) => (
                  <div key={court.id} className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black uppercase tracking-tight italic">{court.name}</span>
                      <span className={`text-[8px] font-black uppercase tracking-widest ${court.current_match_id ? 'text-amber-500' : 'text-green-500'}`}>
                        {court.current_match_id ? 'Occupied' : 'Available'}
                      </span>
                    </div>
                    <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                      {court.tournaments?.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Match Assignments */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Trophy className="text-primary" size={20} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight italic">
              {activeMainTab === 'assignments' ? 'Live Match Assignments' : 'Match History'}
            </h2>
          </div>

          <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-white/5">
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Match</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Status</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Referee</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.filter(m => activeMainTab === 'assignments' ? m.status !== 'submitted' : m.status === 'submitted').length > 0 ? (
                    matches.filter(m => activeMainTab === 'assignments' ? m.status !== 'submitted' : m.status === 'submitted').map((match) => (
                      <tr key={match.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black uppercase tracking-tight italic">{(match as any).match_players?.[0]?.players?.display_name || 'Unknown'}</span>
                            <span className="text-primary font-black italic">VS</span>
                            <span className="text-xs font-black uppercase tracking-tight italic">{(match as any).match_players?.[1]?.players?.display_name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className={`inline-flex px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                            match.status === 'pending' ? 'bg-slate-500/10 text-slate-500' :
                            match.status === 'in_progress' ? 'bg-amber-500/10 text-amber-500' :
                            match.status === 'submitted' ? 'bg-green-500/10 text-green-500' :
                            'bg-primary/10 text-primary'
                          }`}>
                            {match.status.replace('_', ' ')}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <select
                            value={(match as any).ref_id || ''}
                            onChange={(e) => handleAssignRef(match.id, e.target.value)}
                            className="bg-transparent text-xs font-bold uppercase tracking-widest text-muted-foreground focus:outline-none focus:text-primary transition-colors"
                          >
                            <option value="">Unassigned</option>
                            {referees.map(ref => (
                              <option key={ref.id} value={ref.id}>{ref.display_name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex gap-2">
                            {activeMainTab === 'assignments' ? (
                              <>
                                <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors" title="Manual Assign">
                                  <User size={14} />
                                </button>
                                <Link href={`/scorer/${match.id}`} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors" title="View Match">
                                  <ExternalLink size={14} />
                                </Link>
                              </>
                            ) : (
                              <button 
                                onClick={() => handleReopenMatch(match.id)}
                                className="flex items-center gap-2 px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-[8px] font-black uppercase tracking-widest rounded-lg transition-all"
                              >
                                <RefreshCw size={10} /> Reopen
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center">
                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No matches found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
