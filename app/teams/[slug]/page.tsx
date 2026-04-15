'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Team, Player } from '@/types';
import { Users, Trophy, ChevronLeft, User, MapPin, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function TeamProfilePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();

  useEffect(() => {
    const fetchTeamData = async () => {
      setLoading(true);
      try {
        // Fetch team details
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('*')
          .eq('slug', slug)
          .single();

        if (teamError) throw teamError;
        setTeam(teamData);

        // Fetch players in this team
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select(`
            *,
            player_stats (
              matches_played,
              matches_won,
              win_rate,
              ranking_points
            )
          `)
          .eq('team_id', teamData.id)
          .order('ranking_points', { ascending: false });

        if (playersError) throw playersError;
        setPlayers(playersData || []);
      } catch (err) {
        console.error('Error fetching team data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchTeamData();
  }, [slug, supabase]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Loading Team Profile...</p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl font-black uppercase italic mb-4">Team Not Found</h1>
        <Link href="/rankings" className="text-primary font-bold uppercase tracking-widest text-xs hover:underline">
          Back to Rankings
        </Link>
      </div>
    );
  }

  const totalPoints = players.reduce((sum, p) => sum + (p.ranking_points || 0), 0);
  const avgWinRate = players.length > 0 
    ? (players.reduce((sum, p) => sum + ((p as any).player_stats?.[0]?.win_rate || 0), 0) / players.length).toFixed(1)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <Link href="/rankings" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white mb-12 transition-colors">
        <ChevronLeft size={14} /> Back to Rankings
      </Link>

      {/* Hero Section */}
      <div className="relative mb-20">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent rounded-[3rem] -z-10" />
        <div className="flex flex-col md:flex-row items-center gap-12 p-12">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-48 h-48 rounded-[2.5rem] bg-card border-2 border-border overflow-hidden flex items-center justify-center shadow-2xl relative group"
          >
            {team.logo_url ? (
              <img src={team.logo_url} alt={team.name} className="w-full h-full object-cover" />
            ) : (
              <Users size={64} className="text-primary/40 group-hover:text-primary transition-colors" />
            )}
            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>

          <div className="flex-1 text-center md:text-left">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter italic mb-4 leading-none">
                {team.name}
              </h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 mb-8">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe size={16} className="text-primary" />
                  <span className="text-xs font-black uppercase tracking-widest italic">Global Organization</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users size={16} className="text-primary" />
                  <span className="text-xs font-black uppercase tracking-widest italic">{players.length} Active Bladers</span>
                </div>
              </div>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-2xl">
                {team.description || "This team hasn't added a description yet. They are focused on competitive Beyblade X excellence and community growth."}
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
            <div className="bg-card border border-border rounded-3xl p-6 text-center">
              <div className="text-3xl font-black italic text-primary mb-1">{totalPoints.toLocaleString()}</div>
              <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Total Points</div>
            </div>
            <div className="bg-card border border-border rounded-3xl p-6 text-center">
              <div className="text-3xl font-black italic text-white mb-1">{avgWinRate}%</div>
              <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Avg Win Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Roster Section */}
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Trophy className="text-primary" size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tight italic">Team Roster</h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Ranked by individual points</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {players.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link href={`/players/${player.username}`} className="block group">
                <div className="bg-card border border-border rounded-[2rem] p-6 hover:border-primary transition-all hover:scale-[1.02] shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Trophy size={60} />
                  </div>
                  
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-border group-hover:border-primary transition-colors">
                      {player.avatar_url ? (
                        <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-secondary flex items-center justify-center">
                          <User size={24} className="text-primary" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight italic group-hover:text-primary transition-colors">
                        {player.display_name}
                      </h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        @{player.username}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-border/50 flex items-center justify-between relative z-10">
                    <div>
                      <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Win Rate</div>
                      <div className="text-lg font-black italic text-white">{(player as any).player_stats?.[0]?.win_rate || 0}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Clash Points</div>
                      <div className="text-lg font-black italic text-primary">{player.ranking_points.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
