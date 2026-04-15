'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Match, Player } from '@/types';
import { LayoutDashboard, Play, CheckCircle, Clock, User, Filter, Shield, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function RefereeDashboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Record<string, { name: string; status: string }>>({});
  const [activeTournamentIds, setActiveTournamentIds] = useState<string[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const supabase = getSupabase();

  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) { setAuthorized(false); setLoading(false); return; }

      // Get player record
      const { data: playerRecord } = await (supabase as any)
        .from('players')
        .select('id')
        .eq('discord_id', user.id)
        .single();

      if (!playerRecord) { setAuthorized(false); setLoading(false); return; }
      setCurrentPlayerId(playerRecord.id);

      // Check role has can_grab_matches (covers Referee, Temp Referee, Ops, Admin)
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('roles(permissions)')
        .eq('player_id', playerRecord.id);

      const canGrab = (userRoles || []).some((r: any) => {
        const perms = r.roles?.permissions;
        return perms?.can_grab_matches || perms?.can_score_matches;
      });

      if (!canGrab) { setAuthorized(false); setLoading(false); return; }
      setAuthorized(true);

      await fetchData(playerRecord.id);
    };

    init();
  }, [supabase]);

  const fetchData = async (playerId: string) => {
    // Fetch active tournaments
    const { data: activeTournaments } = await supabase
      .from('tournaments')
      .select('id, name, status')
      .eq('status', 'active');

    const tMap: Record<string, { name: string; status: string }> = {};
    const tIds: string[] = [];
    for (const t of activeTournaments || []) {
      tMap[t.id] = { name: t.name, status: t.status };
      tIds.push(t.id);
    }
    setTournaments(tMap);
    setActiveTournamentIds(tIds);

    if (tIds.length === 0) {
      setMatches([]);
      setLoading(false);
      return;
    }

    // Fetch pending + this ref's active matches from active tournaments
    const { data: rawMatches } = await (supabase as any)
      .from('matches')
      .select(`*, match_players (*)`)
      .or(`status.eq.pending,ref_id.eq.${playerId}`)
      .in('tournament_id', tIds)
      .not('status', 'eq', 'submitted')
      .order('created_at', { ascending: false });

    if (rawMatches) {
      // Fetch players manually to avoid PostgREST nested join issues
      const playerIds = new Set<string>();
      rawMatches.forEach((m: any) => {
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

      const enriched = rawMatches.map((m: any) => ({
        ...m,
        match_players: (m.match_players || []).map((mp: any) => ({
          ...mp,
          players: playersMap[mp.player_id] || null,
        })),
      }));
      setMatches(enriched);
    }
    setLoading(false);
  };

  // Real-time: refresh when any match or participant data changes
  useEffect(() => {
    if (!currentPlayerId) return;
    const channel = supabase
      .channel('referee-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        fetchData(currentPlayerId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players' }, () => {
        fetchData(currentPlayerId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_entrants' }, () => {
        fetchData(currentPlayerId);
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [currentPlayerId, supabase]);

  const handleGrabMatch = async (matchId: string) => {
    if (!currentPlayerId) return;
    const { error } = await (supabase as any)
      .from('matches')
      .update({ ref_id: currentPlayerId, status: 'grabbed' })
      .eq('id', matchId)
      .eq('status', 'pending'); // optimistic lock — only grabs if still pending

    if (error) toast.error('Could not grab match — someone else may have taken it.');
    else toast.success('Match grabbed!');
  };

  const handleUngrabMatch = async (matchId: string) => {
    const { error } = await (supabase as any)
      .from('matches')
      .update({ ref_id: null, status: 'pending' })
      .eq('id', matchId);
    if (error) toast.error('Error releasing match.');
    else toast.success('Match released.');
  };

  const handleRefresh = async () => {
    if (!currentPlayerId) return;
    setRefreshing(true);
    try {
      await fetchData(currentPlayerId);
      toast.success('Matches refreshed');
    } catch (err) {
      toast.error('Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncAll = async () => {
    if (activeTournamentIds.length === 0) return;
    setSyncing(true);
    try {
      let successCount = 0;
      for (const tId of activeTournamentIds) {
        const res = await fetch('/api/challonge/sync-tournament', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournamentId: tId })
        });
        if (res.ok) successCount++;
      }
      if (successCount > 0) {
        toast.success(`Synced ${successCount} tournaments from Challonge`);
        if (currentPlayerId) await fetchData(currentPlayerId);
      } else {
        toast.error('Failed to sync from Challonge');
      }
    } catch (err) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LayoutDashboard className="text-primary animate-pulse" size={48} />
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 text-center px-6">
        <Shield size={48} className="text-muted-foreground opacity-30" />
        <h2 className="text-2xl font-black uppercase tracking-tight italic">Access Restricted</h2>
        <p className="text-muted-foreground text-sm">You need a Referee or Staff role to access this page.</p>
        <Link href="/" className="btn-purple px-8 py-3 text-xs font-black uppercase tracking-widest">Go Home</Link>
      </div>
    );
  }

  const visibleMatches = selectedTournament === 'all'
    ? matches
    : matches.filter(m => (m as any).tournament_id === selectedTournament);

  const myMatches = visibleMatches.filter(m => (m as any).ref_id === currentPlayerId);
  const availableMatches = visibleMatches.filter(m => m.status === 'pending');

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-5xl font-black uppercase tracking-tighter italic mb-2">
            Referee <span className="text-primary">Dashboard</span>
          </h1>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">
            Grab matches and score live — active tournaments only
          </p>
        </div>

        {activeTournamentIds.length > 0 && (
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSyncAll}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 disabled:opacity-50"
              title="Sync from Challonge"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Challonge'}
            </button>
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-muted-foreground hover:text-primary transition-all active:scale-95 disabled:opacity-50"
              title="Refresh Local"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <Filter size={14} className="text-muted-foreground ml-2" />
            <select
              value={selectedTournament}
              onChange={e => setSelectedTournament(e.target.value)}
              className="input-dark text-xs py-2 px-3 rounded-xl"
            >
              <option value="all">All Active Tournaments</option>
              {activeTournamentIds.map(id => (
                <option key={id} value={id}>{tournaments[id]?.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeTournamentIds.length === 0 ? (
        <div className="bg-white/5 border border-dashed border-border rounded-[2rem] p-16 text-center">
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No active tournaments right now</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* ── My Assignments ── */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <LayoutDashboard className="text-primary" size={20} />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight italic">My Assignments</h2>
              {myMatches.length > 0 && (
                <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">
                  {myMatches.length} active
                </span>
              )}
            </div>

            <AnimatePresence mode="popLayout">
              {myMatches.length > 0 ? myMatches.map((match) => (
                <motion.div
                  key={match.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-card border border-border rounded-[2rem] p-8 shadow-xl hover:border-primary/30 transition-all"
                >
                  {/* Tournament label */}
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary/70 bg-primary/10 px-3 py-1 rounded-full">
                      {tournaments[(match as any).tournament_id]?.name || 'Tournament'}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                      match.status === 'in_progress' ? 'bg-amber-500/10 text-amber-500' :
                      match.status === 'submitted'   ? 'bg-green-500/10 text-green-500' :
                                                       'bg-primary/10 text-primary'
                    }`}>
                      {match.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-6">
                    {/* Players */}
                    <div className="flex items-center gap-6 flex-1">
                      {((match as any).match_players || []).slice(0, 2).map((mp: any, idx: number) => (
                        <div key={mp.player_id} className={`text-center flex-1 ${idx === 1 ? 'order-last' : ''}`}>
                          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-border mx-auto mb-2">
                            {mp.players?.avatar_url
                              ? <img src={mp.players.avatar_url} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full bg-secondary flex items-center justify-center"><User size={20} className="text-primary" /></div>}
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest truncate">
                            {mp.players?.display_name || '...'}
                          </div>
                        </div>
                      ))}
                      <div className="text-xl font-black italic text-primary">VS</div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {match.status !== 'submitted' && (
                        <Link href={`/scorer/${match.id}`}
                          className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 transition-all">
                          <Play size={13} />
                          {match.status === 'in_progress' ? 'Resume' : 'Score'}
                        </Link>
                      )}
                      {match.status === 'grabbed' && (
                        <button onClick={() => handleUngrabMatch(match.id)}
                          className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                          Release
                        </button>
                      )}
                      {match.status === 'submitted' && (
                        <div className="flex items-center gap-2 px-5 py-2.5 bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest rounded-xl">
                          <CheckCircle size={13} /> Done
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )) : (
                <div className="bg-white/5 border border-dashed border-border rounded-[2rem] p-12 text-center">
                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No active assignments — grab a match from the queue</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Available Matches ── */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <Clock className="text-amber-500" size={20} />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight italic">Queue</h2>
              {availableMatches.length > 0 && (
                <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full">
                  {availableMatches.length} waiting
                </span>
              )}
            </div>

            <div className="space-y-4">
              {availableMatches.length > 0 ? availableMatches.map((match) => (
                <div key={match.id}
                  className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-all">
                  {/* Tournament label */}
                  <div className="text-[9px] font-black uppercase tracking-widest text-primary/60 mb-3">
                    {tournaments[(match as any).tournament_id]?.name || 'Tournament'}
                    {(match as any).stage && <span className="text-white/30"> · {(match as any).stage}</span>}
                  </div>

                  <div className="flex items-center justify-center gap-3 mb-4">
                    <span className="text-xs font-black uppercase tracking-tight italic truncate max-w-[90px]">
                      {(match as any).match_players?.[0]?.players?.display_name || '...'}
                    </span>
                    <span className="text-primary font-black italic text-sm">VS</span>
                    <span className="text-xs font-black uppercase tracking-tight italic truncate max-w-[90px]">
                      {(match as any).match_players?.[1]?.players?.display_name || '...'}
                    </span>
                  </div>

                  <button onClick={() => handleGrabMatch(match.id)}
                    className="w-full py-2.5 bg-white/5 hover:bg-primary hover:text-white text-muted-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                    Grab Match
                  </button>
                </div>
              )) : (
                <p className="text-center py-12 text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
                  No matches in queue
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
