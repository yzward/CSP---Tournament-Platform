'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Team, Player } from '@/types';
import { Users, Trophy, ChevronLeft, MapPin, ExternalLink, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function TeamDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();

  useEffect(() => {
    const fetchTeamData = async () => {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('slug', slug)
        .single();

      if (teamData) {
        setTeam(teamData);
        const { data: membersData } = await supabase
          .from('players')
          .select('*')
          .eq('team_id', teamData.id)
          .order('ranking_points', { ascending: false });
        
        if (membersData) setMembers(membersData);
      }
      setLoading(false);
    };
    fetchTeamData();
  }, [slug, supabase]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Users className="text-primary animate-pulse" size={48} /></div>;
  if (!team) return <div className="p-12 text-center">Team not found</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <Link href="/teams" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white mb-8 transition-colors">
        <ChevronLeft size={14} /> Back to Teams
      </Link>

      <div className="relative mb-16">
        <div className="absolute inset-0 bg-primary/10 blur-[100px] -z-10" />
        
        <div className="flex flex-col md:flex-row items-center gap-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-48 h-48 rounded-[3rem] overflow-hidden border-4 border-primary/20 shadow-2xl shadow-primary/20 bg-card flex items-center justify-center"
          >
            {team.logo_url ? (
              <img src={team.logo_url} alt={team.name} className="w-full h-full object-cover" />
            ) : (
              <Users size={64} className="text-primary" />
            )}
          </motion.div>

          <div className="flex-1 text-center md:text-left space-y-4">
            <h1 className="text-6xl font-black uppercase tracking-tighter italic leading-none">
              {team.name}
            </h1>
            <p className="text-xl font-bold text-muted-foreground uppercase tracking-widest">Professional Organization</p>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-8 pt-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users size={18} className="text-primary" />
                <span className="text-xs font-black uppercase tracking-widest">{members.length} Members</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Trophy size={18} className="text-primary" />
                <span className="text-xs font-black uppercase tracking-widest">
                  Avg Points: {members.length > 0 ? Math.round(members.reduce((acc, m) => acc + m.ranking_points, 0) / members.length).toLocaleString() : 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Shield className="text-primary" size={20} />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight italic">Team Roster</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {members.map((player) => (
                <Link key={player.id} href={`/players/${player.username}`}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="bg-card border border-border rounded-2xl p-6 flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center">
                        {player.avatar_url ? (
                          <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Users size={16} className="text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-black uppercase tracking-tight italic group-hover:text-primary transition-colors">
                          {player.display_name}
                        </div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          {player.region}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black italic text-primary">{player.ranking_points.toLocaleString()}</div>
                      <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Points</div>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>

            {members.length === 0 && (
              <div className="p-12 text-center bg-white/5 rounded-3xl border border-dashed border-border">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No members in this roster yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-xs font-black uppercase tracking-widest mb-6 italic">About the Team</h3>
            <p className="text-xs text-muted-foreground font-medium leading-relaxed">
              {team.description || 'This organization has not provided a description yet.'}
            </p>
          </div>

          <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-xs font-black uppercase tracking-widest mb-6 italic">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Founded</span>
                <span className="text-[10px] font-black uppercase tracking-widest">{new Date(team.created_at).getFullYear()}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Points</span>
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {members.reduce((acc, m) => acc + m.ranking_points, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
