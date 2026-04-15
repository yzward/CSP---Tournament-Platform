'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Player, Match, Tournament } from '@/types';
import { 
  Trophy, Swords, TrendingUp, Activity, 
  Calendar, MapPin, ChevronRight, User,
  Target, Zap, Shield, Star
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function PlayerProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [player, setPlayer] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();

  useEffect(() => {
    const fetchPlayerData = async () => {
      setLoading(true);
      
      // 1. Get player basic info and stats
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select(`
          *,
          team:teams (*),
          player_stats (*)
        `)
        .eq('username', username)
        .single();

      if (playerError || !playerData) {
        setLoading(false);
        return;
      }

      setPlayer(playerData);

      // 2. Get recent matches
      const { data: matchesData } = await supabase
        .from('matches')
        .select(`
          *,
          tournament:tournaments(name, date),
          player1:players!player1_id(display_name, avatar_url, username),
          player2:players!player2_id(display_name, avatar_url, username),
          match_players (*)
        `)
        .or(`player1_id.eq.${playerData.id},player2_id.eq.${playerData.id}`)
        .order('created_at', { ascending: false })
        .limit(10);

      setMatches(matchesData || []);

      // 3. Get tournament history
      const { data: entrantsData } = await supabase
        .from('tournament_entrants')
        .select(`
          *,
          tournament:tournaments(*)
        `)
        .eq('player_id', playerData.id)
        .order('created_at', { ascending: false });

      setTournaments(entrantsData || []);
      setLoading(false);
    };

    fetchPlayerData();
  }, [username, supabase]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Activity className="animate-spin text-primary" /></div>;
  if (!player) return <div className="min-h-screen flex items-center justify-center text-white">Player not found</div>;

  const stats = player.player_stats?.[0] || {};
  const winRate = stats.win_rate ? (stats.win_rate * 100).toFixed(1) : '0.0';
  
  const finishData = [
    { name: 'EXT', value: stats.ext_count || 0, color: '#f59e0b' },
    { name: 'OVR', value: stats.ovr_count || 0, color: '#3b82f6' },
    { name: 'BUR', value: stats.bur_count || 0, color: '#ef4444' },
    { name: 'SPN', value: stats.spn_count || 0, color: '#10b981' },
  ].filter(d => d.value > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header Section */}
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent blur-3xl -z-10 opacity-50" />
        <div className="flex flex-col md:flex-row gap-8 items-center md:items-end">
          <div className="relative">
            <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden border-4 border-card shadow-2xl bg-secondary flex items-center justify-center">
              {player.avatar_url ? (
                <img src={player.avatar_url} alt={player.display_name} className="w-full h-full object-cover" />
              ) : (
                <User size={64} className="text-primary/40" />
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-primary text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
              Ranked
            </div>
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
              <h1 className="text-5xl font-black uppercase tracking-tighter italic">{player.display_name}</h1>
              <span className="text-muted-foreground font-bold uppercase tracking-widest text-xs mt-2">@{player.username}</span>
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">{player.region || 'Global'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-primary" />
                {player.team ? (
                  <Link 
                    href={`/teams/${player.team.slug}`}
                    className="text-[10px] font-black uppercase tracking-widest hover:text-primary transition-colors"
                  >
                    {player.team.name}
                  </Link>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-widest">{player.club || 'Independent'}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">Joined {new Date(player.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="text-center md:text-right">
            <div className="text-6xl font-black italic text-primary leading-none mb-2">
              {player.ranking_points?.toLocaleString()}
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Clash Points</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Distribution */}
        <div className="space-y-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-3xl p-6 text-center">
              <div className="text-2xl font-black italic mb-1">{stats.matches_played || 0}</div>
              <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Matches</div>
            </div>
            <div className="bg-card border border-border rounded-3xl p-6 text-center">
              <div className="text-2xl font-black italic text-primary mb-1">{winRate}%</div>
              <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Win Rate</div>
            </div>
          </div>

          {/* Finish Distribution */}
          <div className="bg-card border border-border rounded-[2.5rem] p-8">
            <h2 className="text-sm font-black uppercase tracking-widest mb-8 flex items-center gap-2">
              <Target size={16} className="text-primary" />
              Finish Distribution
            </h2>
            
            {finishData.length > 0 ? (
              <div className="h-64 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={finishData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {finishData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#13131f', border: '1px solid #27272a', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-2xl font-black italic">{(stats.ext_count || 0) + (stats.ovr_count || 0) + (stats.bur_count || 0) + (stats.spn_count || 0)}</div>
                  <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Finishes</div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center opacity-20">
                <Zap size={48} className="mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">No finish data yet</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-8">
              {finishData.map((d) => (
                <div key={d.name} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <div className="flex-1">
                    <div className="text-[10px] font-black uppercase tracking-tight italic">{d.name}</div>
                    <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{d.value} Recorded</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Column: Recent Matches */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3">
              <Swords size={20} className="text-primary" />
              Recent Matches
            </h2>
          </div>

          <div className="space-y-4">
            {matches.length > 0 ? (
              matches.map((match) => {
                const isP1 = match.player1_id === player.id;
                const opponent = isP1 ? match.player2 : match.player1;
                const scores = match.scores || { player1: 0, player2: 0 };
                const myScore = isP1 ? scores.player1 : scores.player2;
                const oppScore = isP1 ? scores.player2 : scores.player1;
                const won = match.winner_id === player.id;

                return (
                  <div key={match.id} className="bg-card border border-border rounded-3xl p-6 hover:border-primary/30 transition-all group">
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black italic text-xl ${
                          won ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {won ? 'W' : 'L'}
                        </div>
                        <div>
                          <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                            {match.tournament?.name} · {new Date(match.created_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black uppercase tracking-tight italic">VS</span>
                            <Link href={`/players/${opponent?.username}`} className="flex items-center gap-2 group/opp">
                              <div className="w-6 h-6 rounded-full overflow-hidden border border-border group-hover/opp:border-primary transition-colors">
                                {opponent?.avatar_url ? (
                                  <img src={opponent.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-secondary flex items-center justify-center"><User size={10} className="text-primary" /></div>
                                )}
                              </div>
                              <span className="text-sm font-black uppercase tracking-tight italic group-hover/opp:text-primary transition-colors">{opponent?.display_name}</span>
                            </Link>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-black italic tracking-tighter">
                          <span className={won ? 'text-green-500' : 'text-white'}>{myScore}</span>
                          <span className="text-muted-foreground mx-2">–</span>
                          <span className={!won ? 'text-red-500' : 'text-white'}>{oppScore}</span>
                        </div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mt-1">Final Score</div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-card border border-border rounded-[2.5rem] p-20 text-center opacity-20">
                <Swords size={48} className="mx-auto mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">No matches recorded yet</p>
              </div>
            )}
          </div>

          {/* Tournament History */}
          <div className="pt-8">
            <h2 className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3 mb-8">
              <Trophy size={20} className="text-primary" />
              Tournament History
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tournaments.length > 0 ? (
                tournaments.map((entrant) => (
                  <div key={entrant.id} className="bg-card border border-border rounded-3xl p-6 flex items-center justify-between group hover:border-primary/30 transition-all">
                    <div>
                      <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                        {new Date(entrant.tournament?.date).toLocaleDateString()}
                      </div>
                      <div className="text-sm font-black uppercase tracking-tight italic group-hover:text-primary transition-colors">
                        {entrant.tournament?.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-black italic ${
                        entrant.placement === 1 ? 'text-amber-500' : 
                        entrant.placement === 2 ? 'text-slate-400' : 
                        entrant.placement === 3 ? 'text-amber-700' : 'text-white'
                      }`}>
                        #{entrant.placement || '-'}
                      </div>
                      <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Placement</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full bg-card border border-border rounded-[2.5rem] p-12 text-center opacity-20">
                  <Trophy size={32} className="mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No tournaments entered yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
