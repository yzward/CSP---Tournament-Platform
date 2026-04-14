'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Player, Match, Tournament } from '@/types';
import { Trophy, Zap, MapPin, Users, Calendar, User, ArrowUpRight, ArrowDownRight, Minus, Shield, Swords } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { toast } from 'sonner';

import CollectionManager from '@/components/CollectionManager';

export default function PlayerProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [player, setPlayer] = useState<Player | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Record<string, Tournament>>({});
  const [finishTypes, setFinishTypes] = useState<Record<string, number>>({});
  const [tournamentHistory, setTournamentHistory] = useState<any[]>([]);
  const [rankingPosition, setRankingPosition] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const decodedUsername = decodeURIComponent(username);
      
      // Try exact match on username first
      let { data: playerData, error } = await supabase
        .from('players')
        .select(`
          *,
          player_stats (*),
          tournament_entrants (
            placement,
            points_awarded,
            tournaments (id, name, held_at, is_ranking_tournament)
          )
        `)
        .ilike('username', decodedUsername)
        .maybeSingle();

      // If not found, try display_name
      if (!playerData) {
        const { data: byDisplayName } = await supabase
          .from('players')
          .select(`
            *,
            player_stats (*),
            tournament_entrants (
              placement,
              points_awarded,
              tournaments (id, name, held_at, is_ranking_tournament)
            )
          `)
          .ilike('display_name', decodedUsername)
          .maybeSingle();
        playerData = byDisplayName;
      }

      // If still not found, try partial match on username
      if (!playerData) {
        const { data: partialMatch } = await supabase
          .from('players')
          .select(`
            *,
            player_stats (*),
            tournament_entrants (
              placement,
              points_awarded,
              tournaments (id, name, held_at, is_ranking_tournament)
            )
          `)
          .ilike('username', `%${decodedUsername}%`)
          .limit(1)
          .maybeSingle();
        playerData = partialMatch;
      }

      if (playerData) {
        setPlayer(playerData);

        // Fetch ranking position
        const { count } = await supabase
          .from('players')
          .select('id', { count: 'exact', head: true })
          .gt('ranking_points', playerData.ranking_points);
        
        setRankingPosition((count || 0) + 1);

        // Fetch recent matches
        const { data: playerMatches } = await supabase
          .from('match_players')
          .select('match_id')
          .eq('player_id', playerData.id);

        const matchIds = playerMatches?.map((mp: any) => mp.match_id) || [];

        if (matchIds.length > 0) {
          const { data: matchesData } = await supabase
            .from('matches')
            .select(`*, tournaments (name), match_players (player_id, sets_won, total_points, winner, players (id, display_name, avatar_url, username))`)
            .in('id', matchIds)
            .eq('status', 'submitted')
            .order('created_at', { ascending: false })
            .limit(10);

          if (matchesData) setMatches(matchesData as any[]);
        }

        // Set finish types from player_stats
        const stats = playerData.player_stats?.[0] || {};
        setFinishTypes({
          EXT: stats.ext_count || 0,
          OVR: stats.ovr_count || 0,
          BUR: stats.bur_count || 0,
          SPN: stats.spn_count || 0,
          WRN: stats.wrn_count || 0,
          PEN: stats.pen_count || 0
        });

        // Set tournament history
        if (playerData.tournament_entrants) {
          setTournamentHistory(playerData.tournament_entrants);
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [username, supabase]);

  const [activeTab, setActiveTab] = useState<'stats' | 'collection' | 'settings'>('stats');
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [startggUserId, setStartggUserId] = useState('');
  const [isUpdatingStartGG, setIsUpdatingStartGG] = useState(false);
  const [region, setRegion] = useState('');
  const [isUpdatingRegion, setIsUpdatingRegion] = useState(false);

  useEffect(() => {
    if (player?.startgg_user_id) {
      setStartggUserId(player.startgg_user_id);
    }
    if (player?.region) {
      setRegion(player.region);
    }
  }, [player]);

  useEffect(() => {
    const checkOwnership = async () => {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (user && player) {
        // discord_id stores the Supabase auth user.id (set during OAuth callback)
        setIsOwnProfile(user.id === player.discord_id);
      }
    };
    checkOwnership();
  }, [player, supabase]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleUpdateStartGG = async () => {
    if (!player) return;
    setIsUpdatingStartGG(true);
    try {
      const { error } = await supabase
        .from('players')
        .update({ startgg_user_id: startggUserId })
        .eq('id', player.id);

      if (error) throw error;
      toast.success('Start.gg ID updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update start.gg ID');
    } finally {
      setIsUpdatingStartGG(false);
    }
  };

  const handleUpdateRegion = async () => {
    if (!player) return;
    setIsUpdatingRegion(true);
    try {
      const { error } = await supabase
        .from('players')
        .update({ region })
        .eq('id', player.id);

      if (error) throw error;
      toast.success('Region updated');
      setPlayer({ ...player, region });
    } catch (error: any) {
      toast.error(error.message || 'Failed to update region');
    } finally {
      setIsUpdatingRegion(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Trophy className="text-primary animate-pulse" size={48} /></div>;
  if (!player) return <div className="p-12 text-center">Player not found</div>;

  const stats = (player as any).player_stats?.[0] || {};
  const winCount = stats.matches_won || 0;
  const matchesPlayed = stats.matches_played || 0;
  const lossCount = matchesPlayed - winCount;
  const winRate = matchesPlayed > 0 ? (winCount / matchesPlayed) * 100 : 0;

  const totalFinishes = Object.values(finishTypes).reduce((a, b) => a + b, 0);
  const getFinishPercent = (type: string) => {
    if (totalFinishes === 0) return 0;
    return ((finishTypes[type] || 0) / totalFinishes) * 100;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-primary/10 blur-[100px] -z-10" />
        
        <div className="flex flex-col md:flex-row items-center gap-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-48 h-48 rounded-[3rem] overflow-hidden border-4 border-primary/20 shadow-2xl shadow-primary/20"
          >
            {player.avatar_url ? (
              <img src={player.avatar_url} alt={player.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-secondary flex items-center justify-center"><User size={64} className="text-primary" /></div>
            )}
          </motion.div>

          <div className="flex-1 text-center md:text-left space-y-4">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
              <h1 className="text-6xl font-black uppercase tracking-tighter italic leading-none">
                {player.display_name}
              </h1>
              <div className="flex items-center gap-2">
                <span className="px-4 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                  {player.region}
                </span>
                {(!player.discord_id || player.discord_id.startsWith('unclaimed_') || player.discord_id.includes('@')) && (
                  <span className="px-4 py-1 bg-slate-500/10 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-slate-500/20">
                    Unclaimed
                  </span>
                )}
              </div>
            </div>
            <p className="text-xl font-bold text-muted-foreground uppercase tracking-widest">@{player.username}</p>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-8 pt-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users size={18} className="text-primary" />
                <span className="text-xs font-black uppercase tracking-widest">{player.club || 'Independent'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin size={18} className="text-primary" />
                <span className="text-xs font-black uppercase tracking-widest">{player.region}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 min-w-[200px]">
            <div className="bg-card border border-border rounded-[2.5rem] p-6 flex flex-col items-center justify-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Global Rank</div>
              <div className="text-4xl font-black italic text-primary">
                {rankingPosition ? `#${rankingPosition}` : '-'}
              </div>
            </div>
            <div className="bg-card border border-border rounded-[2.5rem] p-6 flex flex-col items-center justify-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Ranking Points</div>
              <div className="text-4xl font-black italic text-primary">{player.ranking_points.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-12 border-b border-border pb-4">
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'stats' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white hover:bg-white/5'
          }`}
        >
          Stats & History
        </button>
        <button
          onClick={() => setActiveTab('collection')}
          className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'collection' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white hover:bg-white/5'
          }`}
        >
          Collection & Decks
        </button>
        {isOwnProfile && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'settings' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white hover:bg-white/5'
            }`}
          >
            Settings
          </button>
        )}
      </div>

      {activeTab === 'stats' ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-card border border-border rounded-[2rem] p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Win Rate</div>
                <Zap className="text-primary" size={16} />
              </div>
              <div className="text-4xl font-black italic mb-2">{winRate.toFixed(1)}%</div>
              <div className="flex gap-4">
                <div className="text-[10px] font-bold text-green-500 uppercase tracking-widest">{winCount} Wins</div>
                <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{lossCount} Losses</div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-[2rem] p-8 md:col-span-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-8">Finish Type Breakdown</div>
              <div className="flex h-12 w-full rounded-xl overflow-hidden bg-white/5">
                <div className="bg-red-500 h-full" style={{ width: `${getFinishPercent('EXT')}%` }} title="EXT" />
                <div className="bg-amber-500 h-full" style={{ width: `${getFinishPercent('OVR')}%` }} title="OVR" />
                <div className="bg-blue-500 h-full" style={{ width: `${getFinishPercent('BUR')}%` }} title="BUR" />
                <div className="bg-green-500 h-full" style={{ width: `${getFinishPercent('SPN')}%` }} title="SPN" />
                <div className="bg-purple-500 h-full" style={{ width: `${getFinishPercent('PEN')}%` }} title="PEN" />
                <div className="bg-slate-500 h-full" style={{ width: `${getFinishPercent('WRN')}%` }} title="WRN" />
              </div>
              <div className="flex flex-wrap gap-4 mt-6">
                {[
                  { type: 'EXT', color: 'bg-red-500' },
                  { type: 'OVR', color: 'bg-amber-500' },
                  { type: 'BUR', color: 'bg-blue-500' },
                  { type: 'SPN', color: 'bg-green-500' },
                  { type: 'PEN', color: 'bg-purple-500' },
                  { type: 'WRN', color: 'bg-slate-500' }
                ].map((item) => (
                  <div key={item.type} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                      {item.type} ({finishTypes[item.type] || 0})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Head to Head */}
          {matches.length > 0 && (() => {
            const h2h: Record<string, { opponent: any; wins: number; losses: number }> = {};
            matches.forEach((match: any) => {
              const mps = match.match_players || [];
              const myMp = mps.find((mp: any) => mp.player_id === player.id);
              const oppMp = mps.find((mp: any) => mp.player_id !== player.id);
              if (!myMp || !oppMp) return;
              const opponentId = oppMp.player_id;
              const won = myMp.winner;
              if (!h2h[opponentId]) h2h[opponentId] = { opponent: oppMp.players, wins: 0, losses: 0 };
              if (won) h2h[opponentId].wins++; else h2h[opponentId].losses++;
            });
            const sorted = Object.values(h2h).sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));
            if (sorted.length === 0) return null;
            return (
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Swords className="text-primary" size={20} />
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-tight italic">Head to Head</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sorted.map(({ opponent, wins, losses }) => opponent && (
                    <Link key={opponent.id} href={`/players/${opponent.username}`} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-all flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-border flex-shrink-0">
                        {opponent.avatar_url
                          ? <img src={opponent.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-secondary flex items-center justify-center"><User size={16} className="text-primary" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black uppercase tracking-tight italic truncate">{opponent.display_name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{wins + losses} matches</div>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-black italic flex-shrink-0">
                        <span className="text-green-500">{wins}</span>
                        <span className="text-muted-foreground">-</span>
                        <span className="text-red-500">{losses}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* History Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Recent Matches */}
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Zap className="text-primary" size={20} />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight italic">Recent Matches</h2>
              </div>

              <div className="space-y-4">
                {matches.map((match: any) => {
                  const mps = match.match_players || [];
                  const myMp = mps.find((mp: any) => mp.player_id === player.id);
                  const oppMp = mps.find((mp: any) => mp.player_id !== player.id);

                  if (!myMp || !oppMp) return null;
                  const isWinner = myMp.winner;
                  const opponent = oppMp.players;
                  const myScore = myMp.sets_won;
                  const oppScore = oppMp.sets_won;
                  
                  return (
                    <div key={match.id} className="bg-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-all flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isWinner ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                          {isWinner ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                            {match.tournaments?.name || 'Tournament'}
                          </div>
                          <div className="text-sm font-black uppercase tracking-tight italic">
                            vs {opponent?.display_name || 'Unknown'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black italic text-primary">
                          {myScore} - {oppScore}
                        </div>
                        <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                          {new Date(match.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tournament History */}
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <Calendar className="text-amber-500" size={20} />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight italic">Tournament History</h2>
              </div>

              <div className="space-y-4">
                {tournamentHistory.length > 0 ? (
                  tournamentHistory.map((history, idx) => (
                    <div key={idx} className="bg-card border border-border rounded-2xl p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black italic ${
                          history.placement === 1 ? 'bg-amber-500/10 text-amber-500' :
                          history.placement === 2 ? 'bg-slate-400/10 text-slate-400' :
                          history.placement === 3 ? 'bg-amber-700/10 text-amber-700' :
                          'bg-white/5 text-muted-foreground'
                        }`}>
                          {history.placement ? <>{history.placement}{history.placement === 1 ? 'st' : history.placement === 2 ? 'nd' : history.placement === 3 ? 'rd' : 'th'}</> : '-'}
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                            {history.tournaments?.held_at ? new Date(history.tournaments.held_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                          </div>
                          <div className="text-sm font-black uppercase tracking-tight italic">{history.tournaments?.name || 'Unknown Event'}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-black italic ${history.points_awarded > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          {history.points_awarded > 0 ? `+${history.points_awarded.toLocaleString()}` : '0'}
                        </div>
                        <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                          {history.tournaments?.held_at ? new Date(history.tournaments.held_at).toLocaleDateString() : 'Unknown Date'}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center bg-white/5 rounded-2xl border border-dashed border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No tournament history yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : activeTab === 'collection' ? (
        <CollectionManager playerId={player.id} readOnly={!isOwnProfile} />
      ) : (
        <div className="max-w-md space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Shield className="text-primary" size={20} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight italic">Account Settings</h2>
          </div>

          <div className="bg-card border border-border rounded-3xl p-8 space-y-6">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest mb-2 italic">Password Login</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
                Set a password to enable email login alongside Discord.
              </p>
            </div>

            {false ? (
              // players.status column removed — password form always shown to own profile
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                  Account approval required to set a password.
                </p>
              </div>
            ) : (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="w-full py-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {isUpdatingPassword ? 'Updating...' : 'Set Password'}
                </button>
              </form>
            )}
          </div>

          <div className="bg-card border border-border rounded-3xl p-8 space-y-6">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest mb-2 italic">Profile Information</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
                Update your public profile details.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Region</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                    placeholder="e.g. North America, Europe"
                  />
                  <button
                    onClick={handleUpdateRegion}
                    disabled={isUpdatingRegion}
                    className="px-6 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isUpdatingRegion ? '...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-8 space-y-6">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest mb-2 italic">Start.gg Integration</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
                Link your start.gg account to sync tournament results and rankings. You can find your User ID in your start.gg profile settings.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Start.gg User ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={startggUserId}
                    onChange={(e) => setStartggUserId(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                    placeholder="e.g. 123456"
                  />
                  <button
                    onClick={handleUpdateStartGG}
                    disabled={isUpdatingStartGG}
                    className="px-6 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isUpdatingStartGG ? '...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
