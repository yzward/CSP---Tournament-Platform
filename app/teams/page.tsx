'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Team } from '@/types';
import { Users, Search, Plus, ChevronRight, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();

  useEffect(() => {
    const fetchTeams = async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name');
      
      if (data) setTeams(data);
      setLoading(false);
    };
    fetchTeams();
  }, [supabase]);

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Users className="text-primary" size={20} />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">
              Professional <span className="text-primary">Teams</span>
            </h1>
          </div>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">
            The elite organizations of Clash Stats Pro
          </p>
        </div>

        <div className="relative min-w-[300px]">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-muted-foreground" />
          </div>
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-2xl pl-12 pr-4 py-4 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-primary transition-colors shadow-xl"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-card border border-border rounded-[2.5rem] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredTeams.map((team) => (
            <Link key={team.id} href={`/teams/${team.slug}`}>
              <motion.div
                whileHover={{ y: -5 }}
                className="bg-card border border-border rounded-[2.5rem] p-8 hover:border-primary/30 transition-all group relative overflow-hidden h-full"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Trophy size={80} />
                </div>

                <div className="flex items-center gap-6 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-secondary border border-border overflow-hidden flex items-center justify-center">
                    {team.logo_url ? (
                      <img src={team.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users size={24} className="text-primary" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight italic group-hover:text-primary transition-colors">
                      {team.name}
                    </h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Professional Team
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground font-medium leading-relaxed mb-8 line-clamp-2">
                  {team.description || 'No description provided.'}
                </p>

                <div className="flex items-center justify-between pt-6 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest">View Roster</span>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      )}

      {!loading && filteredTeams.length === 0 && (
        <div className="text-center py-24">
          <Users size={48} className="mx-auto text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No teams found matching your search</p>
        </div>
      )}
    </div>
  );
}
