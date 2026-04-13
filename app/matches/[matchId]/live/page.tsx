'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Heart, User, Trophy, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const FINISH_COLORS: Record<string, string> = {
  EXT: 'bg-red-500',
  OVR: 'bg-amber-500',
  BUR: 'bg-blue-500',
  SPN: 'bg-green-500',
  WRN: 'bg-slate-500',
  PEN: 'bg-purple-500',
};

// Same reconstruction logic as scorer — keep in sync if scorer changes
function buildState(events: any[], p1Id: string, pointCap: number, setsToWin: number) {
  let score1 = 0, score2 = 0, setsWon1 = 0, setsWon2 = 0, currentSet = 1;
  for (const ev of events) {
    const pts = ev.points ?? 0;
    const isPen = ev.finish_type === 'PEN';
    const p1Scored = ev.scorer_player_id === p1Id;
    if (isPen) { if (p1Scored) score2 += pts; else score1 += pts; }
    else        { if (p1Scored) score1 += pts; else score2 += pts; }
    if (score1 >= pointCap) { setsWon1++; score1 = 0; score2 = 0; currentSet++; }
    else if (score2 >= pointCap) { setsWon2++; score1 = 0; score2 = 0; currentSet++; }
  }
  const matchDone = setsWon1 >= setsToWin || setsWon2 >= setsToWin;
  return { score1, score2, setsWon1, setsWon2, currentSet, matchDone };
}

export default function LiveSpectator({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const supabase = getSupabase();

  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<any>(null);
  const [player1, setPlayer1] = useState<any>(null);
  const [player2, setPlayer2] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [tournament, setTournament] = useState<any>(null);

  const fetchEvents = async () => {
    const { data } = await (supabase as any)
      .from('finish_events').select('*')
      .eq('match_id', matchId).order('created_at', { ascending: true });
    setEvents(data || []);
    return data || [];
  };

  useEffect(() => {
    const load = async () => {
      const { data: m } = await (supabase as any)
        .from('matches')
        .select('*, match_players(*, players(*))')
        .eq('id', matchId).single();
      if (!m) { setLoading(false); return; }
      setMatch(m);
      const mps: any[] = m.match_players || [];
      setPlayer1(mps[0]?.players || null);
      setPlayer2(mps[1]?.players || null);

      const [tRes, evRes] = await Promise.all([
        (supabase as any).from('tournaments').select('id, name, stage_type').eq('id', m.tournament_id).single(),
        (supabase as any).from('finish_events').select('*').eq('match_id', matchId).order('created_at', { ascending: true }),
      ]);
      setTournament(tRes.data);
      setEvents(evRes.data || []);
      setLoading(false);
    };
    load();
  }, [matchId]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`live-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finish_events', filter: `match_id=eq.${matchId}` }, fetchEvents)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (p) => setMatch(p.new))
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [matchId]);

  if (loading) return (
    <div className="min-h-screen bg-[#0d0d14] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!match || !player1 || !player2) return (
    <div className="min-h-screen bg-[#0d0d14] flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Match not found</p>
    </div>
  );

  const pointCap  = match.point_cap  ?? 5;
  const setsToWin = match.sets_to_win ?? 2;
  const { score1, score2, setsWon1, setsWon2, currentSet, matchDone } = buildState(events, player1.id, pointCap, setsToWin);
  const winnerId = matchDone ? (setsWon1 >= setsToWin ? player1.id : player2.id) : null;

  const feed = [...events].reverse().slice(0, 12);

  return (
    <div className="min-h-screen bg-[#0d0d14] text-white flex flex-col">

      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 text-center">
        <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">
          {tournament?.name} · {match.stage || 'Match'} · Live
        </div>
        <div className="flex items-center justify-center gap-2">
          <div className={`w-2 h-2 rounded-full ${matchDone ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            {matchDone ? 'Finished' : 'Live'}
          </span>
        </div>
      </div>

      {/* Match complete banner */}
      <AnimatePresence>
        {matchDone && winnerId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-primary/10 border-b border-primary/20 py-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Trophy size={18} className="text-primary" />
              <span className="text-sm font-black uppercase tracking-widest italic text-primary">
                {winnerId === player1.id ? player1.display_name : player2.display_name} wins!
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main score display */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-12">

        {/* Players + scores */}
        <div className="flex items-center gap-8 md:gap-16 w-full max-w-2xl">

          {/* P1 */}
          <div className="flex-1 flex flex-col items-center gap-3">
            <div className={`w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden border-2 transition-all ${winnerId === player1.id ? 'border-primary shadow-xl shadow-primary/30' : 'border-white/10'}`}>
              {player1.avatar_url
                ? <img src={player1.avatar_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-[#1a1a28] flex items-center justify-center"><User size={32} className="text-primary" /></div>}
            </div>
            <div className="text-center">
              <div className="text-sm font-black uppercase tracking-tight italic">{player1.display_name}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-widest">{player1.club || 'Independent'}</div>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: setsToWin }).map((_, i) => (
                <Heart key={i} size={14} className={i < setsWon1 ? 'text-primary fill-primary' : 'text-white/10'} />
              ))}
            </div>
          </div>

          {/* Scores */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-4 md:gap-6">
              <motion.span
                key={`s1-${score1}`}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-7xl md:text-9xl font-black italic tabular-nums text-white"
              >
                {score1}
              </motion.span>
              <span className="text-xl font-black italic text-white/20">–</span>
              <motion.span
                key={`s2-${score2}`}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-7xl md:text-9xl font-black italic tabular-nums text-white"
              >
                {score2}
              </motion.span>
            </div>
            <div className="px-3 py-1 bg-white/5 rounded-full">
              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                Set {currentSet} · First to {pointCap}
              </span>
            </div>
          </div>

          {/* P2 */}
          <div className="flex-1 flex flex-col items-center gap-3">
            <div className={`w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden border-2 transition-all ${winnerId === player2.id ? 'border-cyan-400 shadow-xl shadow-cyan-500/30' : 'border-white/10'}`}>
              {player2.avatar_url
                ? <img src={player2.avatar_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-[#1a1a28] flex items-center justify-center"><User size={32} className="text-cyan-400" /></div>}
            </div>
            <div className="text-center">
              <div className="text-sm font-black uppercase tracking-tight italic">{player2.display_name}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-widest">{player2.club || 'Independent'}</div>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: setsToWin }).map((_, i) => (
                <Heart key={i} size={14} className={i < setsWon2 ? 'text-cyan-400 fill-cyan-400' : 'text-white/10'} />
              ))}
            </div>
          </div>
        </div>

        {/* Sets won summary */}
        <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
          <span>{setsWon1} sets</span>
          <span className="text-white/10">·</span>
          <span>Best of {setsToWin * 2 - 1}</span>
          <span className="text-white/10">·</span>
          <span>{setsWon2} sets</span>
        </div>

        {/* Play-by-play feed */}
        {feed.length > 0 && (
          <div className="w-full max-w-sm space-y-2">
            <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground text-center mb-3">Play by play</div>
            <AnimatePresence initial={false}>
              {feed.map((ev) => {
                const isP1 = ev.scorer_player_id === player1.id;
                const isPen = ev.finish_type === 'PEN';
                // For display: show who committed the PEN vs who scored
                const actorName = isP1 ? player1.display_name : player2.display_name;
                const scorerName = isPen ? (isP1 ? player2.display_name : player1.display_name) : actorName;
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between px-4 py-2.5 bg-white/5 rounded-xl border border-white/5"
                  >
                    <span className="text-[9px] font-bold uppercase tracking-tight truncate max-w-[120px]">
                      {isPen ? `${actorName} → ${scorerName}` : actorName}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white ${FINISH_COLORS[ev.finish_type] ?? 'bg-primary'}`}>
                        {ev.finish_type}
                      </span>
                      {ev.points > 0 && (
                        <span className="text-[8px] font-black text-muted-foreground">+{ev.points}</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {events.length === 0 && !matchDone && (
          <div className="text-center py-8">
            <Zap className="text-muted-foreground mx-auto mb-3 opacity-20" size={32} />
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Waiting for match to start…</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 px-6 py-3 text-center">
        <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/40">
          ClashStats · Live Match View · Updates automatically
        </p>
      </div>
    </div>
  );
}
