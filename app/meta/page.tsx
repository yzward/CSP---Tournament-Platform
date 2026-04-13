'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Trophy, Zap, BarChart3, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

const FINISH_COLORS: Record<string, string> = {
  EXT: 'bg-red-500',
  OVR: 'bg-amber-500',
  BUR: 'bg-blue-500',
  SPN: 'bg-green-500',
  WRN: 'bg-slate-500',
  PEN: 'bg-purple-500',
};

export default function MetaPage() {
  const [finishStats, setFinishStats] = useState<Record<string, number>>({});
  const [topBeyblades, setTopBeyblades] = useState<Array<{ name: string; uses: number; wins: number }>>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();

  useEffect(() => {
    const fetchMeta = async () => {
      // Finish type distribution from finish_events
      const { data: logs } = await (supabase as any)
        .from('finish_events')
        .select('finish_type, points, scorer_player_id, match_id');

      if (logs) {
        setTotalLogs(logs.length);
        const counts: Record<string, number> = {};
        for (const log of logs) {
          counts[log.finish_type] = (counts[log.finish_type] || 0) + 1;
        }
        setFinishStats(counts);
      }

      // Top beyblades by usage (via finish_events joined to beyblades)
      const { data: beyLogs } = await (supabase as any)
        .from('finish_events')
        .select('bey_id, scorer_player_id, match_id, beyblades(name)')
        .not('bey_id', 'is', null);

      if (beyLogs && beyLogs.length > 0) {
        const beyUsage: Record<string, { name: string; uses: number; playerMatchPairs: Array<{ matchId: string; playerId: string }> }> = {};
        for (const log of beyLogs) {
          const name = log.beyblades?.name;
          if (!name) continue;
          if (!beyUsage[name]) beyUsage[name] = { name, uses: 0, playerMatchPairs: [] };
          beyUsage[name].uses++;
          beyUsage[name].playerMatchPairs.push({ matchId: log.match_id, playerId: log.scorer_player_id });
        }

        // Determine winners via match_players (winner boolean)
        const allMatchIds = [...new Set(beyLogs.map((l: any) => l.match_id))];
        const { data: mpData } = await (supabase as any)
          .from('match_players')
          .select('match_id, player_id, winner')
          .in('match_id', allMatchIds)
          .eq('winner', true);

        const winnerMap: Record<string, string> = {};
        for (const mp of mpData || []) winnerMap[mp.match_id] = mp.player_id;

        const beyWins: Record<string, number> = {};
        for (const log of beyLogs) {
          const name = log.beyblades?.name;
          if (!name) continue;
          if (winnerMap[log.match_id] === log.scorer_player_id) {
            beyWins[name] = (beyWins[name] || 0) + 1;
          }
        }

        const sorted = Object.values(beyUsage)
          .sort((a, b) => b.uses - a.uses)
          .slice(0, 10)
          .map(b => ({ name: b.name, uses: b.uses, wins: beyWins[b.name] || 0 }));

        setTopBeyblades(sorted);
      }

      setLoading(false);
    };

    fetchMeta();
  }, [supabase]);

  const totalFinishes = Object.values(finishStats).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-12">
        <h1 className="text-5xl font-black uppercase tracking-tighter italic mb-4">
          Meta <span className="text-primary">Stats</span>
        </h1>
        <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">
          Aggregate performance data across all recorded matches
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Trophy className="text-primary animate-pulse" size={48} />
        </div>
      ) : (
        <div className="space-y-16">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-[2rem] p-8 text-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Total Finishes Logged</div>
              <div className="text-4xl font-black italic text-primary">{totalLogs.toLocaleString()}</div>
            </div>
            <div className="bg-card border border-border rounded-[2rem] p-8 text-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Most Common Finish</div>
              <div className="text-4xl font-black italic text-primary">
                {Object.entries(finishStats).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'}
              </div>
            </div>
            <div className="bg-card border border-border rounded-[2rem] p-8 text-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Unique Beyblades Tracked</div>
              <div className="text-4xl font-black italic text-primary">{topBeyblades.length}</div>
            </div>
          </div>

          {/* Finish Type Distribution */}
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Zap className="text-primary" size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight italic">Finish Types</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {totalLogs.toLocaleString()} total finish logs recorded
                </p>
              </div>
            </div>

            {totalFinishes === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">No match logs yet</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-[2rem] p-8 space-y-8">
                <div className="flex h-16 w-full rounded-xl overflow-hidden bg-white/5">
                  {(['EXT', 'OVR', 'BUR', 'SPN', 'WRN', 'PEN'] as const).map((type) => {
                    const pct = totalFinishes > 0 ? ((finishStats[type] || 0) / totalFinishes) * 100 : 0;
                    return pct > 0 ? (
                      <div key={type} className={`${FINISH_COLORS[type]} h-full`} style={{ width: `${pct}%` }} title={`${type}: ${pct.toFixed(1)}%`} />
                    ) : null;
                  })}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {(['EXT', 'OVR', 'BUR', 'SPN', 'WRN', 'PEN'] as const).map((type) => {
                    const count = finishStats[type] || 0;
                    const pct = totalFinishes > 0 ? (count / totalFinishes) * 100 : 0;
                    return (
                      <motion.div key={type} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/5 rounded-2xl p-4 text-center">
                        <div className={`w-3 h-3 rounded-full ${FINISH_COLORS[type]} mx-auto mb-3`} />
                        <div className="text-xl font-black italic">{type}</div>
                        <div className="text-2xl font-black italic text-primary mt-1">{pct.toFixed(1)}%</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{count.toLocaleString()}</div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Top Beyblades */}
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="text-amber-500" size={20} />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight italic">Top Beyblades by Usage</h2>
            </div>

            {topBeyblades.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">No beyblade data yet — log matches with bey tracking enabled</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-[2rem] overflow-hidden">
                <div className="grid grid-cols-4 px-8 py-4 border-b border-border bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  <span>#</span>
                  <span>Beyblade</span>
                  <span className="text-right">Usage</span>
                  <span className="text-right">Win Rate</span>
                </div>
                {topBeyblades.map((bey, i) => {
                  const winRate = bey.uses > 0 ? (bey.wins / bey.uses) * 100 : 0;
                  return (
                    <motion.div
                      key={bey.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="grid grid-cols-4 px-8 py-5 border-b border-border/50 hover:bg-white/5 transition-colors items-center"
                    >
                      <span className={`text-xl font-black italic ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                        {i + 1}
                      </span>
                      <span className="text-sm font-black uppercase tracking-tight italic">{bey.name}</span>
                      <div className="text-right">
                        <div className="text-sm font-black italic text-primary">{bey.uses}</div>
                        <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">uses</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-black italic ${winRate >= 50 ? 'text-green-500' : 'text-red-400'}`}>
                          {winRate.toFixed(1)}%
                        </div>
                        <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{bey.wins}W / {bey.uses - bey.wins}L</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
