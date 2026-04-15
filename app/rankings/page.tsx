'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Player } from '@/types';
import { Trophy, Search, Filter, ChevronLeft, ChevronRight, User, Fingerprint, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function RankingsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('All');
  const [page, setPage] = useState(1);
  const [championLabel, setChampionLabel] = useState('World Champion');
  const [authUser, setAuthUser] = useState<any>(null);
  const [userLinkedPlayerId, setUserLinkedPlayerId] = useState<string | null>(null);
  const [pendingClaimPlayerId, setPendingClaimPlayerId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const pageSize = 25;

  const supabase = getSupabase();

  useEffect(() => {
    const fetchRankings = async () => {
      setLoading(true);
      let query = supabase
        .from('players')
        .select(`
          id,
          username,
          display_name,
          avatar_url,
          club,
          region,
          ranking_points,
          discord_id,
          team:teams (
            id,
            name,
            slug
          ),
          player_stats (
            matches_played,
            matches_won,
            ext_count,
            ovr_count,
            bur_count,
            spn_count,
            wrn_count,
            pen_count,
            win_rate,
            tournaments_entered,
            swiss_king_total,
            best_placement
          )
        `, { count: 'exact' })
        .eq('status', 'approved')
        .order('ranking_points', { ascending: false });

      if (search) {
        query = query.ilike('display_name', `%${search}%`);
      }

      if (region !== 'All') {
        query = query.eq('region', region);
      }

      const { data, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        console.error('Error fetching rankings:', error);
      } else {
        setPlayers(data || []);
      }
      setLoading(false);
    };

    fetchRankings();
  }, [search, region, page, supabase]);

  useEffect(() => {
    const fetchContent = async () => {
      const { data } = await supabase
        .from('site_content')
        .select('content')
        .eq('id', 'rankings.podium.champion_label')
        .single();

      if (data) setChampionLabel(data.content);
    };
    fetchContent();
  }, [supabase]);

  // Auth state — check if signed in and whether they already have a linked/claimed profile
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setAuthUser(user);

      // Already linked?
      const { data: linked } = await supabase
        .from('players')
        .select('id')
        .eq('discord_id', user.id)
        .maybeSingle();
      if (linked) { setUserLinkedPlayerId(linked.id); return; }

      // Pending claim?
      const { data: claim } = await supabase
        .from('account_claims')
        .select('player_id')
        .eq('auth_user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();
      if (claim) setPendingClaimPlayerId(claim.player_id);
    };
    checkAuth();
  }, [supabase]);

  const handleClaim = async (player: any) => {
    if (!authUser) { window.location.href = '/login'; return; }
    setClaimingId(player.id);
    try {
      const discordUsername =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.custom_claims?.global_name ||
        authUser.email;

      const { error } = await supabase.from('account_claims').insert({
        auth_user_id: authUser.id,
        player_id: player.id,
        status: 'pending',
        discord_username: discordUsername,
        email: authUser.email,
      });
      if (error) throw error;
      setPendingClaimPlayerId(player.id);
      toast.success(`Claim submitted for ${player.display_name}! An admin will review it soon.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit claim');
    } finally {
      setClaimingId(null);
    }
  };

  const regions = ['All', 'North America', 'Europe', 'Asia', 'Oceania', 'South America'];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
        <div>
          <h1 className="text-6xl font-black uppercase tracking-tighter italic mb-4">
            Global <span className="text-primary">Rankings</span>
          </h1>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px] mb-1">
            The official Clash Stats Pro leaderboard
          </p>
          <p className="text-muted-foreground/60 font-bold uppercase tracking-widest text-[8px]">
            Finish stats shown as per-event averages. Stats populate as matches are scored.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search Player..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-card border border-border rounded-xl pl-12 pr-4 py-3 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-primary transition-all w-full md:w-64"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="bg-card border border-border rounded-xl pl-12 pr-8 py-3 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-primary appearance-none transition-all"
            >
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Podium Section */}
      {!search && region === 'All' && page === 1 && players.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 items-end max-w-5xl mx-auto">
          {/* 2nd Place */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="order-2 md:order-1"
          >
            <div className="relative bg-card border border-border rounded-[2.5rem] p-8 text-center card-glow group">
              <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-slate-400 shadow-[0_0_30px_rgba(148,163,184,0.3)]">
                  {players[1].avatar_url ? (
                    <img src={players[1].avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center"><User size={32} className="text-primary" /></div>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-slate-400 rounded-lg flex items-center justify-center text-black font-black italic">2</div>
              </div>
              <div className="mt-12">
                <h3 className="text-xl font-black italic uppercase tracking-tight truncate">{players[1].display_name}</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">{players[1].region}</p>
                <div className="text-2xl font-black italic text-slate-400">{players[1].ranking_points.toLocaleString()} PTS</div>
              </div>
            </div>
          </motion.div>

          {/* 1st Place */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="order-1 md:order-2"
          >
            <div className="relative bg-card border-2 border-amber-500/30 rounded-[3rem] p-10 text-center shadow-[0_0_50px_rgba(245,158,11,0.15)] group">
              <div className="absolute -top-16 left-1/2 -translate-x-1/2">
                <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.4)]">
                  {players[0].avatar_url ? (
                    <img src={players[0].avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center"><User size={48} className="text-primary" /></div>
                  )}
                </div>
                <div className="absolute -bottom-3 -right-3 w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-black font-black italic text-xl">1</div>
              </div>
              <div className="mt-16">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full mb-4">
                  <Trophy size={12} className="text-amber-500" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-500">{championLabel}</span>
                </div>
                <h3 className="text-3xl font-black italic uppercase tracking-tight truncate">{players[0].display_name}</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6">{players[0].region}</p>
                <div className="text-4xl font-black italic text-amber-500">{players[0].ranking_points.toLocaleString()} PTS</div>
              </div>
            </div>
          </motion.div>

          {/* 3rd Place */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="order-3"
          >
            <div className="relative bg-card border border-border rounded-[2.5rem] p-8 text-center card-glow group">
              <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-amber-700 shadow-[0_0_30px_rgba(146,64,14,0.3)]">
                  {players[2].avatar_url ? (
                    <img src={players[2].avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center"><User size={32} className="text-primary" /></div>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-amber-700 rounded-lg flex items-center justify-center text-white font-black italic">3</div>
              </div>
              <div className="mt-12">
                <h3 className="text-xl font-black italic uppercase tracking-tight truncate">{players[2].display_name}</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">{players[2].region}</p>
                <div className="text-2xl font-black italic text-amber-700">{players[2].ranking_points.toLocaleString()} PTS</div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="border-b border-border bg-white/5">
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Rank</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Blader</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Team</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Clash Points</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">PPS</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">SPN/E</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">BUR/E</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">OVR/E</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">EXT/E</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">PP/E</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">SK</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">W/L</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Played</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center w-24">Claim</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-6 py-6"><div className="w-8 h-8 bg-white/5 rounded-lg animate-pulse" /></td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
                        <div className="space-y-2">
                          <div className="w-24 h-3 bg-white/5 rounded animate-pulse" />
                          <div className="w-16 h-2 bg-white/5 rounded animate-pulse" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6"><div className="w-20 h-3 bg-white/5 rounded animate-pulse" /></td>
                    <td className="px-6 py-6 text-right"><div className="w-16 h-4 bg-white/5 rounded ml-auto animate-pulse" /></td>
                    <td className="px-6 py-6 text-right"><div className="w-10 h-3 bg-white/5 rounded ml-auto animate-pulse" /></td>
                    <td className="px-6 py-6 text-right"><div className="w-8 h-3 bg-white/5 rounded ml-auto animate-pulse" /></td>
                    <td className="px-6 py-6 text-right"><div className="w-8 h-3 bg-white/5 rounded ml-auto animate-pulse" /></td>
                    <td className="px-6 py-6 text-right"><div className="w-8 h-3 bg-white/5 rounded ml-auto animate-pulse" /></td>
                    <td className="px-6 py-6 text-right"><div className="w-8 h-3 bg-white/5 rounded ml-auto animate-pulse" /></td>
                    <td className="px-6 py-6 text-right"><div className="w-8 h-3 bg-white/5 rounded ml-auto animate-pulse" /></td>
                    <td className="px-6 py-6 text-right"><div className="w-8 h-3 bg-white/5 rounded ml-auto animate-pulse" /></td>
                    <td className="px-6 py-6 text-center"><div className="w-12 h-3 bg-white/5 rounded mx-auto animate-pulse" /></td>
                    <td className="px-6 py-6 text-right"><div className="w-8 h-3 bg-white/5 rounded ml-auto animate-pulse" /></td>
                    <td className="px-6 py-6 text-center"><div className="w-14 h-6 bg-white/5 rounded ml-auto animate-pulse" /></td>
                  </tr>
                ))
              ) : players.length > 0 ? (
                players.map((player, index) => {
                  const rank = (page - 1) * pageSize + index + 1;
                  const stats = (player as any).player_stats?.[0] || (player as any).player_stats || {};
                  
                  const matchesPlayed = stats.matches_played || 0;
                  const matchesWon = stats.matches_won || 0;
                  const matchesLost = matchesPlayed - matchesWon;
                  const tournamentsEntered = stats.tournaments_entered || 0;
                  
                  const ext = stats.ext_count || 0;
                  const ovr = stats.ovr_count || 0;
                  const bur = stats.bur_count || 0;
                  const spn = stats.spn_count || 0;
                  const pen = stats.pen_count || 0;
                  const sk = stats.swiss_king_total || 0;

                  // Ratios (per event)
                  const extE = tournamentsEntered > 0 ? (ext / tournamentsEntered).toFixed(2) : "0.00";
                  const ovrE = tournamentsEntered > 0 ? (ovr / tournamentsEntered).toFixed(2) : "0.00";
                  const burE = tournamentsEntered > 0 ? (bur / tournamentsEntered).toFixed(2) : "0.00";
                  const spnE = tournamentsEntered > 0 ? (spn / tournamentsEntered).toFixed(2) : "0.00";
                  const penE = tournamentsEntered > 0 ? (pen / tournamentsEntered).toFixed(2) : "0.00";

                  // PPS: (SPN×1 + BUR×2 + OVR×2 + EXT×3 + PEN×1) / tournaments_entered
                  const totalFinishPoints = (spn * 1) + (bur * 2) + (ovr * 2) + (ext * 3) + (pen * 1);
                  const pps = tournamentsEntered > 0 ? (totalFinishPoints / tournamentsEntered).toFixed(2) : "0.00";

                  return (
                    <motion.tr
                      key={player.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={`border-b border-border/50 hover:bg-white/5 transition-colors group relative ${
                        rank <= 3 ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="px-6 py-6 relative">
                        {rank <= 3 && (
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                            rank === 1 ? 'bg-amber-400' :
                            rank === 2 ? 'bg-slate-400' :
                            'bg-amber-700'
                          }`} />
                        )}
                        {rank > 3 && rank <= 10 && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                        )}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black italic ${
                          rank === 1 ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20' :
                          rank === 2 ? 'bg-slate-300 text-black shadow-lg shadow-slate-300/20' :
                          rank === 3 ? 'bg-amber-700 text-white shadow-lg shadow-amber-700/20' :
                          'text-muted-foreground'
                        }`}>
                          {rank}
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <Link href={`/players/${player.username}`} className="flex items-center gap-3 group/link">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-border group-hover/link:border-primary transition-colors shrink-0">
                            {player.avatar_url ? (
                              <img src={player.avatar_url} alt={player.display_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-secondary flex items-center justify-center">
                                <User size={14} className="text-primary" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black uppercase tracking-tight italic group-hover/link:text-primary transition-colors truncate text-xs">
                                {player.display_name}
                              </span>
                              {(player as any).discord_id ? (
                                <span title="Claimed" className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                              ) : (
                                <span title="Unclaimed" className="w-1.5 h-1.5 rounded-full border border-muted-foreground/40 shrink-0" />
                              )}
                            </div>
                            <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest truncate">
                              @{player.username}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-6">
                        {player.team ? (
                          <Link 
                            href={`/teams/${(player.team as any).slug}`}
                            className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors truncate block max-w-[120px] text-left"
                          >
                            {(player.team as any).name}
                          </Link>
                        ) : (
                          <button 
                            onClick={() => {
                              setSearch(player.club || '');
                              setPage(1);
                            }}
                            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors truncate block max-w-[120px] text-left"
                          >
                            {player.club || 'Independent'}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-6 text-right">
                        <div className="text-sm font-black italic text-primary">
                          {player.ranking_points.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <div className="text-xs font-bold text-white">
                          {pps}
                        </div>
                      </td>
                      <td className="px-6 py-6 text-right text-[10px] font-bold text-muted-foreground">{spnE}</td>
                      <td className="px-6 py-6 text-right text-[10px] font-bold text-muted-foreground">{burE}</td>
                      <td className="px-6 py-6 text-right text-[10px] font-bold text-muted-foreground">{ovrE}</td>
                      <td className="px-6 py-6 text-right text-[10px] font-bold text-muted-foreground">{extE}</td>
                      <td className="px-6 py-6 text-right text-[10px] font-bold text-muted-foreground">{penE}</td>
                      <td className="px-6 py-6 text-right text-[10px] font-bold text-muted-foreground">{sk}</td>
                      <td className="px-6 py-6 text-center text-[10px] font-bold text-white">
                        {matchesWon}/{matchesLost}
                      </td>
                      <td className="px-6 py-6 text-right text-[10px] font-bold text-primary">
                        {tournamentsEntered}
                      </td>
                      <td className="px-6 py-6 text-center">
                        {/* Already this user's linked profile */}
                        {userLinkedPlayerId === player.id ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 text-green-400 text-[8px] font-black uppercase tracking-widest">
                            <CheckCircle2 size={10} /> You
                          </span>
                        ) : /* Player is claimed by someone else */
                        (player as any).discord_id ? (
                          <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest">—</span>
                        ) : /* Pending claim on this player by current user */
                        pendingClaimPlayerId === player.id ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[8px] font-black uppercase tracking-widest">
                            <Clock size={10} /> Pending
                          </span>
                        ) : /* Signed in — show Claim button */
                        authUser ? (
                          userLinkedPlayerId || pendingClaimPlayerId ? (
                            // User already has a linked profile or pending claim elsewhere — disable
                            <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest">—</span>
                          ) : (
                            <button
                              onClick={() => handleClaim(player)}
                              disabled={claimingId === player.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[8px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all disabled:opacity-50"
                            >
                              <Fingerprint size={10} />
                              {claimingId === player.id ? '...' : 'Claim'}
                            </button>
                          )
                        ) : (
                          /* Not signed in — show login nudge */
                          <Link
                            href="/login"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-muted-foreground border border-white/10 text-[8px] font-black uppercase tracking-widest hover:border-primary/30 hover:text-primary transition-all"
                          >
                            <Fingerprint size={10} /> Claim
                          </Link>
                        )}
                      </td>
                    </motion.tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={14} className="px-6 py-20 text-center">
                    <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No players found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-8 py-6 bg-white/5 flex items-center justify-between">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Showing {players.length} players per page
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 bg-card border border-border rounded-lg disabled:opacity-50 hover:border-primary transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={players.length < pageSize}
              className="p-2 bg-card border border-border rounded-lg disabled:opacity-50 hover:border-primary transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
