'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Tournament } from '@/types';
import { Trophy, Calendar, Layout, MapPin, Users, ExternalLink, Zap, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

type FilterTab = 'all' | 'active' | 'completed';

function TournamentCard({ t, i, entrantCounts }: { t: any; i: number; entrantCounts: Record<string, number> }) {
  return (
    <motion.div
      key={t.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className="bg-card border border-border rounded-[2rem] p-6 hover:border-primary/30 transition-all group flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
          t.status === 'active' ? 'bg-green-500/10 text-green-500' :
          t.status === 'completed' ? 'bg-slate-500/10 text-slate-400' :
          'bg-amber-500/10 text-amber-400'
        }`}>
          {t.status === 'active' ? 'Live' : t.status}
        </span>
        {t.is_ranking_tournament && (
          <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-primary/10 text-primary">
            Ranked
          </span>
        )}
      </div>
      <h2 className="text-xl font-black uppercase tracking-tight italic mb-4 group-hover:text-primary transition-colors line-clamp-2">
        {t.name}
      </h2>
      {t.description && (
        <p className="text-xs text-muted-foreground mb-4 line-clamp-2 leading-relaxed">{t.description}</p>
      )}
      <div className="flex flex-wrap gap-4 mb-6 mt-auto">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar size={12} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {t.held_at ? new Date(t.held_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Layout size={12} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {FORMAT_LABELS[t.stage1_format] || t.stage1_format || '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users size={12} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest">{entrantCounts[t.id] ?? '—'} Players</span>
        </div>
        {t.location && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin size={12} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest truncate max-w-[120px]">{t.location}</span>
          </div>
        )}
      </div>
      <Link href={`/tournaments/${t.id}`}
        className="flex items-center justify-center gap-2 w-full py-3 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
        <ExternalLink size={12} /> View Tournament
      </Link>
    </motion.div>
  );
}

const FORMAT_LABELS: Record<string, string> = {
  single_elim: 'Single Elim',
  double_elim: 'Double Elim',
  round_robin: 'Round Robin',
  swiss: 'Swiss',
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [entrantCounts, setEntrantCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [historyOpen, setHistoryOpen] = useState(false);
  const supabase = getSupabase();

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await (supabase as any)
        .from('tournaments')
        .select('*')
        .order('held_at', { ascending: false });

      if (data) {
        // Sort: active first, then pending, then completed — newest first within each group
        const statusOrder: Record<string, number> = { active: 0, pending: 1, completed: 2 };
        const sorted = [...data].sort((a, b) => {
          const ao = statusOrder[a.status] ?? 3;
          const bo = statusOrder[b.status] ?? 3;
          if (ao !== bo) return ao - bo;
          return new Date(b.held_at).getTime() - new Date(a.held_at).getTime();
        });
        setTournaments(sorted);

        // Fetch entrant counts per tournament
        const counts: Record<string, number> = {};
        await Promise.all(
          data.map(async (t: Tournament) => {
            const { count } = await supabase
              .from('tournament_entrants')
              .select('id', { count: 'exact', head: true })
              .eq('tournament_id', t.id);
            counts[t.id] = count || 0;
          })
        );
        setEntrantCounts(counts);
      }
      setLoading(false);
    };

    fetchData();
  }, [supabase]);

  // Split into active/upcoming and completed history
  const active = tournaments.filter(t => t.status !== 'completed');
  const completed = tournaments.filter(t => t.status === 'completed');

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-12">
        <h1 className="text-5xl font-black uppercase tracking-tighter italic mb-4">
          Tournaments <span className="text-primary">Hub</span>
        </h1>
        <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">
          Official Clash Stats competitive events — synced live from Challonge
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Trophy className="text-primary animate-pulse" size={48} />
        </div>
      ) : (
        <>
          {/* ── Active / Upcoming ─────────────────────────────── */}
          {active.length === 0 ? (
            <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-[2.5rem] mb-12">
              <Zap className="text-muted-foreground/20 mx-auto mb-4" size={48} />
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No active tournaments right now</p>
              <p className="text-muted-foreground/40 text-[10px] uppercase tracking-widest mt-2">Check back soon or view history below</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-16">
              {active.map((t, i) => (
                <TournamentCard key={t.id} t={t} i={i} entrantCounts={entrantCounts} />
              ))}
            </div>
          )}

          {/* ── Completed History ─────────────────────────────── */}
          {completed.length > 0 && (
            <div>
              <button
                onClick={() => setHistoryOpen(h => !h)}
                className="flex items-center gap-3 mb-6 group"
              >
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-muted-foreground" />
                  <span className="text-sm font-black uppercase tracking-widest text-muted-foreground group-hover:text-white transition-colors">
                    Tournament History
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white/5 text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                    {completed.length}
                  </span>
                </div>
                {historyOpen
                  ? <ChevronUp size={16} className="text-muted-foreground" />
                  : <ChevronDown size={16} className="text-muted-foreground" />}
              </button>

              {historyOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                >
                  {completed.map((t, i) => (
                    <TournamentCard key={t.id} t={t} i={i} entrantCounts={entrantCounts} />
                  ))}
                </motion.div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
