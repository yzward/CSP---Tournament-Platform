'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import {
  Trophy, Swords, Activity,
  Calendar, MapPin, User,
  Target, Zap, Shield, Star, Crown
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

function ordinal(n: number | null | undefined) {
  if (!n) return '-';
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function PlayerProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [player, setPlayer]       = useState<any>(null);
  const [matchRows, setMatchRows] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [rank, setRank]           = useState<number | null>(null);
  const [loading, setLoading]     = useState(true);
  const supabase = getSupabase();

  useEffect(() => {
    const fetchPlayerData = async () => {
      setLoading(true);

      // ── 1. Player + stats ──────────────────────────────────
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select(`
          *,
          team:teams (*),
          player_stats (
            matches_played,
            matches_won,
            win_rate,
            tournaments_entered,
            spn_count,
            bur_count,
            ovr_count,
            ext_count,
            wrn_count,
            pen_count,
            swiss_king_total,
            best_placement
          )
        `)
        .eq('username', username)
        .single();

      if (playerError || !playerData) { setLoading(false); return; }
      setPlayer(playerData);

      // ── 2. Current rank (players with more Clash Points) ───
      const { count } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .gt('ranking_points', playerData.ranking_points);
      setRank((count ?? 0) + 1);

      // ── 3. Recent submitted matches via match_players ──────
      const { data: mpRows } = await supabase
        .from('match_players')
        .select(`
          sets_won,
          winner,
          match:matches!inner (
            id,
            status,
            stage,
            created_at,
            tournament:tournaments(name, held_at),
            match_players (
              player_id,
              sets_won,
              winner,
              player:players(display_name, avatar_url, username)
            )
          )
        `)
        .eq('player_id', playerData.id)
        .eq('match.status', 'submitted')
        .order('created_at', { ascending: false })
        .limit(10);

      setMatchRows(mpRows || []);

      // ── 4. Tournament history ──────────────────────────────
      const { data: entrantsData } = await supabase
        .from('tournament_entrants')
        .select(`
          placement,
          points_awarded,
          tournament:tournaments(id, name, held_at, is_ranking_tournament)
        `)
        .eq('player_id', playerData.id)
        .order('created_at', { ascending: false });

      setTournaments(entrantsData || []);
      setLoading(false);
    };

    fetchPlayerData();
  }, [username, supabase]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Activity className="animate-spin text-primary" />
    </div>
  );
  if (!player) return (
    <div className="min-h-screen flex items-center justify-center text-white">Player not found</div>
  );

  // ── Computed stats ─────────────────────────────────────────
  const stats  = player.player_stats?.[0] || {};
  const played = stats.tournaments_entered || 0;

  const spn = stats.spn_count || 0;
  const bur = stats.bur_count || 0;
  const ovr = stats.ovr_count || 0;
  const ext = stats.ext_count || 0;
  const pen = stats.pen_count || 0;
  const sk  = stats.swiss_king_total || 0;

  const spnE = played > 0 ? (spn / played).toFixed(2) : '0.00';
  const burE = played > 0 ? (bur / played).toFixed(2) : '0.00';
  const ovrE = played > 0 ? (ovr / played).toFixed(2) : '0.00';
  const extE = played > 0 ? (ext / played).toFixed(2) : '0.00';
  const ppE  = played > 0 ? (pen / played).toFixed(2) : '0.00';
  const pps  = played > 0
    ? ((spn * 1 + bur * 2 + ovr * 2 + ext * 3 + pen * 1) / played).toFixed(2)
    : '0.00';

  const wins   = stats.matches_won   || 0;
  const losses = (stats.matches_played || 0) - wins;
  const winRate = stats.win_rate ? stats.win_rate.toFixed(1) : '0.0';

  const finishData = [
    { name: 'EXT', value: ext, color: '#f59e0b' },
    { name: 'OVR', value: ovr, color: '#3b82f6' },
    { name: 'BUR', value: bur, color: '#ef4444' },
    { name: 'SPN', value: spn, color: '#10b981' },
  ].filter(d => d.value > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">

      {/* ── Hero header ─────────────────────────────────────── */}
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent blur-3xl -z-10 opacity-50" />
        <div className="flex flex-col md:flex-row gap-8 items-center md:items-end">

          {/* Avatar */}
          <div className="relative">
            <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden border-4 border-card shadow-2xl bg-card flex items-center justify-center">
              {player.avatar_url
                ? <img src={player.avatar_url} alt={player.display_name} className="w-full h-full object-cover" />
                : <User size={64} className="text-primary/40" />}
            </div>
            {rank && rank <= 3 && (
              <div className={`absolute -top-3 -right-3 w-10 h-10 rounded-xl flex items-center justify-center font-black italic text-lg ${
                rank === 1 ? 'bg-amber-400 text-black' :
                rank === 2 ? 'bg-slate-300 text-black' :
                             'bg-amber-700 text-white'
              }`}>
                {rank}
              </div>
            )}
          </div>

          {/* Name + meta */}
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
                {player.team
                  ? <Link href={`/teams/${player.team.slug}`} className="text-[10px] font-black uppercase tracking-widest hover:text-primary transition-colors">{player.team.name}</Link>
                  : <span className="text-[10px] font-black uppercase tracking-widest">{player.club || 'Independent'}</span>}
              </div>
              {rank && (
                <div className="flex items-center gap-2">
                  <Trophy size={14} className="text-amber-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Rank #{rank}</span>
                </div>
              )}
            </div>
          </div>

          {/* Clash Points */}
          <div className="text-center md:text-right">
            <div className="text-6xl font-black italic text-primary leading-none mb-2">
              {player.ranking_points?.toLocaleString()}
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Clash Points</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Left column ─────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Key numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-3xl p-5 text-center">
              <div className="text-2xl font-black italic mb-1">{wins}/{losses}</div>
              <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">W / L</div>
            </div>
            <div className="bg-card border border-border rounded-3xl p-5 text-center">
              <div className="text-2xl font-black italic text-primary mb-1">{winRate}%</div>
              <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Win Rate</div>
            </div>
            <div className="bg-card border border-border rounded-3xl p-5 text-center">
              <div className="text-2xl font-black italic text-secondary mb-1">{pps}</div>
              <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">PPS</div>
            </div>
            <div className="bg-card border border-border rounded-3xl p-5 text-center">
              <div className="text-2xl font-black italic mb-1">{played}</div>
              <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Events</div>
            </div>
          </div>

          {/* Swiss King + Best Placement */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-3xl p-5 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Crown size={14} className="text-amber-400" />
                <div className="text-2xl font-black italic text-amber-400">{sk}</div>
              </div>
              <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Swiss King</div>
            </div>
            <div className="bg-card border border-border rounded-3xl p-5 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Trophy size={14} className="text-amber-500" />
                <div className="text-2xl font-black italic text-amber-500">{ordinal(stats.best_placement)}</div>
              </div>
              <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Best Place</div>
            </div>
          </div>

          {/* Finish breakdown */}
          <div className="bg-card border border-border rounded-[2.5rem] p-8">
            <h2 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
              <Target size={16} className="text-primary" />
              Finishes
            </h2>

            {finishData.length > 0 ? (
              <div className="h-48 relative mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={finishData} innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                      {finishData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a0b3b', border: '1px solid #2d1b5d', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-xl font-black italic">{spn + bur + ovr + ext}</div>
                  <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Total</div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center opacity-20 mb-6">
                <Zap size={40} className="mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest">No finish data yet</p>
              </div>
            )}

            {/* Stat rows: raw count + /E ratio */}
            {[
              { label: 'EXT', count: ext, ratio: extE, color: '#f59e0b' },
              { label: 'OVR', count: ovr, ratio: ovrE, color: '#3b82f6' },
              { label: 'BUR', count: bur, ratio: burE, color: '#ef4444' },
              { label: 'SPN', count: spn, ratio: spnE, color: '#10b981' },
              { label: 'PP',  count: pen, ratio: ppE,  color: '#a855f7' },
            ].map(({ label, count, ratio, color }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold text-white w-6 text-right">{count}</span>
                  <span className="text-[10px] font-bold text-muted-foreground w-12 text-right">{ratio}/E</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right columns ────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-10">

          {/* Recent matches */}
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3 mb-6">
              <Swords size={20} className="text-primary" />
              Recent Matches
            </h2>

            <div className="space-y-3">
              {matchRows.length > 0 ? matchRows.map((row, i) => {
                const m = (row as any).match;
                if (!m) return null;
                const myRow = row;
                const oppRow = (m.match_players || []).find((mp: any) => mp.player_id !== player.id);
                const opp   = oppRow?.player;

                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-card border border-border rounded-3xl p-5 hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black italic text-base shrink-0 ${
                          myRow.winner ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {myRow.winner ? 'W' : 'L'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1 truncate">
                            {m.tournament?.name} · {m.stage} · {m.tournament?.held_at ? new Date(m.tournament.held_at).toLocaleDateString() : ''}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase italic">vs</span>
                            {opp ? (
                              <Link href={`/players/${opp.username}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                                <div className="w-6 h-6 rounded-full overflow-hidden border border-border shrink-0">
                                  {opp.avatar_url
                                    ? <img src={opp.avatar_url} alt="" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full bg-card flex items-center justify-center"><User size={10} className="text-primary" /></div>}
                                </div>
                                <span className="text-sm font-black uppercase tracking-tight italic">{opp.display_name}</span>
                              </Link>
                            ) : <span className="text-xs text-muted-foreground">Unknown</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xl font-black italic tracking-tighter">
                          <span className={myRow.winner ? 'text-green-500' : 'text-white'}>{myRow.sets_won}</span>
                          <span className="text-muted-foreground mx-1">–</span>
                          <span className={!myRow.winner ? 'text-red-500' : 'text-white'}>{oppRow?.sets_won ?? '?'}</span>
                        </div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Sets</div>
                      </div>
                    </div>
                  </motion.div>
                );
              }) : (
                <div className="bg-card border border-border rounded-[2.5rem] p-16 text-center opacity-20">
                  <Swords size={40} className="mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No matches recorded yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Tournament history */}
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3 mb-6">
              <Trophy size={20} className="text-primary" />
              Tournament History
            </h2>

            {tournaments.length > 0 ? (
              <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-white/5">
                      <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tournament</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Date</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground text-center">Place</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground text-right">Points</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground text-center">Ranked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournaments.map((entrant, i) => {
                      const t = entrant.tournament;
                      const pl = entrant.placement;
                      return (
                        <tr key={i} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <Link href={`/tournaments/${t?.id}`} className="text-xs font-black uppercase tracking-tight italic hover:text-primary transition-colors">
                              {t?.name}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-[10px] font-bold text-muted-foreground">
                            {t?.held_at ? new Date(t.held_at).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-sm font-black italic ${
                              pl === 1 ? 'text-amber-400' :
                              pl === 2 ? 'text-slate-300' :
                              pl === 3 ? 'text-amber-700' : 'text-white'
                            }`}>
                              {pl === 1 && <Trophy size={12} className="inline mr-1 text-amber-400" />}
                              {ordinal(pl)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-xs font-black italic text-primary">
                            +{entrant.points_awarded || 0}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {t?.is_ranking_tournament
                              ? <Star size={12} className="text-primary inline" />
                              : <span className="text-muted-foreground text-[10px]">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-[2.5rem] p-16 text-center opacity-20">
                <Trophy size={40} className="mx-auto mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">No tournaments entered yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
