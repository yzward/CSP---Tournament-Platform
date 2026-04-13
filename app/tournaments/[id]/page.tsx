'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Tournament, Match, Player } from '@/types';
import { Trophy, Calendar, Layout, Users, Zap, ChevronLeft, ExternalLink, MapPin, UserPlus, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { toast } from 'sonner';
import BracketViewer from '@/components/BracketViewer';

export default function TournamentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [standings, setStandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'results' | 'standings' | 'bracket'>('results');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const supabase = getSupabase();

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: authData }, { data: tData }] = await Promise.all([
        supabase.auth.getUser(),
        (supabase as any).from('tournaments').select('*').eq('id', id).single(),
      ]);
      const user = authData?.user;

      setCurrentUser(user);

      if (tData) {
        setTournament(tData);

        const [matchRes, entrantsRes] = await Promise.all([
          (supabase as any)
            .from('matches')
            .select('*, match_players(player_id, total_points, sets_won, winner, players(id, display_name, username, avatar_url))')
            .eq('tournament_id', id)
            .eq('status', 'submitted')
            .order('created_at', { ascending: false }),
          (supabase as any)
            .from('tournament_entrants')
            .select('*, players(id, display_name, username, avatar_url, ranking_points, club)')
            .eq('tournament_id', id)
            .order('placement', { ascending: true, nullsFirst: false }),
        ]);

        if (matchRes.data) {
          setMatches(matchRes.data);
          // Build players map from embedded match_players
          const pMap: Record<string, Player> = {};
          for (const m of matchRes.data as any[]) {
            for (const mp of m.match_players || []) {
              if (mp.players) pMap[mp.player_id] = mp.players;
            }
          }
          setPlayers(pMap);
        }

        if (entrantsRes.data) {
          setStandings(entrantsRes.data);
        }

        // Check if current user is already registered
        if (user) {
          const { data: playerData } = await supabase
            .from('players')
            .select('id')
            .eq('discord_id', user.id)
            .single();
          if (playerData) {
            const already = entrantsRes.data?.some((e: any) => e.player_id === playerData.id);
            setIsRegistered(!!already);
            setCurrentUser({ ...user, playerId: playerData.id });
          }
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [id, supabase]);

  const handleRegister = async () => {
    if (!currentUser?.playerId) {
      toast.error('You need a verified player account to register');
      return;
    }
    setIsRegistering(true);
    const { error } = await supabase
      .from('tournament_entrants')
      .insert({ tournament_id: id, player_id: currentUser.playerId });

    if (error) {
      toast.error('Failed to register — you may already be registered');
    } else {
      setIsRegistered(true);
      toast.success('Registered successfully!');
    }
    setIsRegistering(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Trophy className="text-primary animate-pulse" size={48} /></div>;
  if (!tournament) return <div className="p-12 text-center">Tournament not found</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <Link
        href="/tournaments"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group"
      >
        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-widest">All Tournaments</span>
      </Link>

      {/* Header */}
      <div className="mb-12">
        <div className="flex flex-wrap items-start justify-between gap-6 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-5xl font-black uppercase tracking-tighter italic">
              {tournament.name}
            </h1>
            <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
              tournament.status === 'active' ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              {tournament.status}
            </span>
          </div>

          {/* Register button */}
          {tournament.status === 'active' && currentUser && (
            isRegistered ? (
              <div className="flex items-center gap-2 px-6 py-3 bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest rounded-xl">
                <CheckCircle size={14} /> Registered
              </div>
            ) : (
              <button
                onClick={handleRegister}
                disabled={isRegistering}
                className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <UserPlus size={14} /> {isRegistering ? 'Registering...' : 'Register'}
              </button>
            )
          )}
        </div>

        {(tournament as any).description && (
          <p className="text-sm text-muted-foreground mb-4 max-w-2xl leading-relaxed">{(tournament as any).description}</p>
        )}

        <div className="flex flex-wrap gap-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar size={16} className="text-primary" />
            <span className="text-xs font-black uppercase tracking-widest">
              {tournament.held_at ? new Date(tournament.held_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date(tournament.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Layout size={16} className="text-primary" />
            <span className="text-xs font-black uppercase tracking-widest">
              {tournament.stage_type === 'two_stage'
                ? `${tournament.stage1_format.replace('_', ' ')} → ${tournament.stage2_format?.replace('_', ' ')}`
                : tournament.stage1_format.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Trophy size={16} className="text-primary" />
            <span className="text-xs font-black uppercase tracking-widest">
              {tournament.is_ranking_tournament ? 'Ranking Event' : 'Casual Event'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users size={16} className="text-primary" />
            <span className="text-xs font-black uppercase tracking-widest">{standings.length} Registered</span>
          </div>
          {(tournament as any).location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin size={16} className="text-primary" />
              <span className="text-xs font-black uppercase tracking-widest">{(tournament as any).location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-12 border-b border-border pb-4">
        {(['results', 'standings', 'bracket'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white hover:bg-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'results' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {matches.map((match) => {
                const mps: any[] = (match as any).match_players || [];
                const mp1 = mps[0];
                const mp2 = mps[1];
                return (
                  <div key={match.id} className="bg-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        {match.stage || 'Match'}
                      </span>
                      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                        {new Date(match.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 text-center">
                        <div className="text-sm font-black uppercase tracking-tight italic mb-1">
                          {mp1?.players?.display_name || 'Unknown'}
                        </div>
                        <div className={`text-3xl font-black italic ${mp1?.winner ? 'text-primary' : 'text-muted-foreground'}`}>
                          {mp1?.total_points ?? 0}
                        </div>
                      </div>
                      <div className="text-muted-foreground font-black italic">VS</div>
                      <div className="flex-1 text-center">
                        <div className="text-sm font-black uppercase tracking-tight italic mb-1">
                          {mp2?.players?.display_name || 'Unknown'}
                        </div>
                        <div className={`text-3xl font-black italic ${mp2?.winner ? 'text-primary' : 'text-muted-foreground'}`}>
                          {mp2?.total_points ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {matches.length === 0 && (
                <div className="col-span-full py-20 text-center bg-card border border-border border-dashed rounded-[2.5rem]">
                  <Zap className="text-muted-foreground mx-auto mb-4 opacity-20" size={48} />
                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No matches recorded yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'standings' && (
            <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden">
              <div className="p-8 border-b border-border bg-white/5 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest italic">
                  {tournament.status === 'completed' ? 'Final Placements' : 'Registered Players'}
                </h3>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {standings.length} players
                </span>
              </div>
              {standings.length === 0 ? (
                <div className="p-8 text-center py-20">
                  <Users className="text-muted-foreground mx-auto mb-4 opacity-20" size={48} />
                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No players registered yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {standings.map((entry: any, idx: number) => {
                    const placement = entry.placement || (idx + 1);
                    const player = entry.players;
                    return (
                      <div key={entry.id || idx} className="flex items-center gap-6 px-8 py-4 hover:bg-white/5 transition-colors">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black italic text-sm flex-shrink-0 ${
                          placement === 1 ? 'bg-amber-500/10 text-amber-500' :
                          placement === 2 ? 'bg-slate-400/10 text-slate-400' :
                          placement === 3 ? 'bg-amber-700/10 text-amber-700' :
                          'bg-white/5 text-muted-foreground'
                        }`}>
                          {tournament.status === 'completed' ? `${placement}${placement === 1 ? 'st' : placement === 2 ? 'nd' : placement === 3 ? 'rd' : 'th'}` : `#${idx + 1}`}
                        </div>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-border flex-shrink-0">
                            {player?.avatar_url ? (
                              <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-secondary flex items-center justify-center text-[10px] font-black text-primary">
                                {player?.display_name?.[0]}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-black uppercase tracking-tight italic truncate">
                              {player?.display_name || 'Unknown'}
                            </div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                              {player?.club || 'Independent'} • {player?.ranking_points ?? 0} pts
                            </div>
                          </div>
                        </div>
                        {tournament.status === 'completed' && entry.points_awarded > 0 && (
                          <div className="text-amber-500 font-black italic text-sm flex-shrink-0">
                            +{entry.points_awarded}
                          </div>
                        )}
                        {player?.username && (
                          <Link
                            href={`/players/${player.username}`}
                            className="p-2 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                          >
                            <ExternalLink size={14} />
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'bracket' && (
            <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden min-h-[600px] flex flex-col">
              <BracketViewer tournamentId={tournament.id} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
