'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Heart, Undo2, User, MessageSquare, Trophy, ArrowLeft, ExternalLink, RefreshCw, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';

const FINISH_TYPES = [
  { id: 'EXT', name: 'EXT', points: 3, colorClass: 'finish-btn-purple' },
  { id: 'OVR', name: 'OVR', points: 2, colorClass: 'finish-btn-purple' },
  { id: 'BUR', name: 'BUR', points: 2, colorClass: 'finish-btn-purple' },
  { id: 'SPN', name: 'SPN', points: 1, colorClass: 'finish-btn-orange' },
  { id: 'WRN', name: 'WRN', points: 0, colorClass: 'finish-btn-orange' },
  { id: 'PEN', name: 'PEN', points: 1, colorClass: 'finish-btn-orange' },
] as const;

type FinishType = typeof FINISH_TYPES[number];

// Replay all finish_events to derive current scorer state.
// PEN: scorer_player_id = the FOULING player (tracked for stats),
//      but the OPPONENT receives the point in the score.
function buildState(events: any[], p1Id: string, pointCap: number, setsToWin: number) {
  let score1 = 0, score2 = 0, setsWon1 = 0, setsWon2 = 0, currentSet = 1;
  for (const ev of events) {
    const pts = ev.points ?? 0;
    const isPen = ev.finish_type === 'PEN';
    const p1Scored = ev.scorer_player_id === p1Id;
    // PEN: fouling player's opponent gets the points
    if (isPen) {
      if (p1Scored) score2 += pts; // p1 fouled → p2 scores
      else           score1 += pts; // p2 fouled → p1 scores
    } else {
      if (p1Scored) score1 += pts;
      else           score2 += pts;
    }
    if (score1 >= pointCap) { setsWon1++; score1 = 0; score2 = 0; currentSet++; }
    else if (score2 >= pointCap) { setsWon2++; score1 = 0; score2 = 0; currentSet++; }
  }
  const matchDone = setsWon1 >= setsToWin || setsWon2 >= setsToWin;
  return { score1, score2, setsWon1, setsWon2, currentSet, matchDone };
}

export default function LiveScorer({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const router = useRouter();
  const supabase = getSupabase();

  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<any>(null);
  const [player1, setPlayer1] = useState<any>(null);
  const [player2, setPlayer2] = useState<any>(null);
  const [p1MpId, setP1MpId] = useState('');
  const [p2MpId, setP2MpId] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [tournament, setTournament] = useState<any>(null);
  const [p1Decks, setP1Decks] = useState<any[]>([]);
  const [p2Decks, setP2Decks] = useState<any[]>([]);
  const [selectedP1Bey, setSelectedP1Bey] = useState('');
  const [selectedP2Bey, setSelectedP2Bey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [acting, setActing] = useState(false);
  // Editable per-match settings (ops can adjust before match starts)
  const [pointCap, setPointCap] = useState(5);
  const [setsToWin, setSetsToWin] = useState(2);

  const fetchEvents = async (): Promise<any[]> => {
    if (matchId === 'test-match') return events;

    const { data, error } = await (supabase as any)
      .from('finish_events').select('*')
      .eq('match_id', matchId).order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to sync events');
    }

    const evs = data || [];
    setEvents(evs);
    return evs;
  };

  useEffect(() => {
    const load = async () => {
      if (matchId === 'test-match') {
        setMatch({ id: 'test-match', tournament_id: 'test-tourney', stage: 'Grand Final', status: 'in_progress', point_cap: 5, sets_to_win: 2 });
        setPlayer1({ id: 'p1', display_name: 'Tyson', username: 'tyson' });
        setPlayer2({ id: 'p2', display_name: 'Kai', username: 'kai' });
        setP1MpId('mp1');
        setP2MpId('mp2');
        setTournament({ name: 'Local Test Tournament' });
        setP1Decks([]);
        setP2Decks([]);
        setEvents([]);
        setLoading(false);
        return;
      }

      const { data: m, error: matchError } = await (supabase as any)
        .from('matches')
        .select('*, match_players(*, players(*))')
        .eq('id', matchId).single();
      
      if (matchError || !m) {
        console.error('Error loading match:', matchError);
        toast.error('Failed to load match data');
        setLoading(false);
        return;
      }
      setMatch(m);
      setNotes(m.notes || '');
      setPointCap(m.point_cap ?? 5);
      setSetsToWin(m.sets_to_win ?? 2);

      const mps: any[] = m.match_players || [];
      setP1MpId(mps[0]?.id || '');
      setP2MpId(mps[1]?.id || '');
      setPlayer1(mps[0]?.players || null);
      setPlayer2(mps[1]?.players || null);

      const p1Id = mps[0]?.player_id;
      const p2Id = mps[1]?.player_id;

      const [tRes, d1Res, d2Res, evRes] = await Promise.all([
        (supabase as any).from('tournaments').select('*').eq('id', m.tournament_id).single(),
        p1Id ? (supabase as any).from('tournament_decks').select('*, decks(*)').eq('tournament_id', m.tournament_id).eq('player_id', p1Id) : { data: [] },
        p2Id ? (supabase as any).from('tournament_decks').select('*, decks(*)').eq('tournament_id', m.tournament_id).eq('player_id', p2Id) : { data: [] },
        (supabase as any).from('finish_events').select('*').eq('match_id', matchId).order('created_at', { ascending: true }),
      ]);
      setTournament(tRes.data);
      setP1Decks(d1Res.data || []);
      setP2Decks(d2Res.data || []);
      setEvents(evRes.data || []);
      setLoading(false);
    };
    load();
  }, [matchId]);

  useEffect(() => {
    if (matchId === 'test-match') return;

    const ch = supabase.channel(`scorer-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finish_events', filter: `match_id=eq.${matchId}` }, fetchEvents)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (p) => setMatch(p.new))
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [matchId]);

  // Derived scorer state
  const ss = player1 ? buildState(events, player1.id, pointCap, setsToWin) : null;
  const { score1 = 0, score2 = 0, setsWon1 = 0, setsWon2 = 0, currentSet = 1, matchDone = false } = ss ?? {};
  const winnerId = matchDone ? (setsWon1 >= setsToWin ? player1?.id : player2?.id) : null;

  // Last action type per player (for the badge)
  const lastP1Event = [...events].reverse().find(e => e.scorer_player_id === player1?.id);
  const lastP2Event = [...events].reverse().find(e => e.scorer_player_id === player2?.id);

  const syncMatch = async (state: ReturnType<typeof buildState>) => {
    if (matchId === 'test-match') {
      setMatch((prev: any) => ({ ...prev, status: state.matchDone ? 'completed' : 'in_progress' }));
      return;
    }

    const { error } = await (supabase as any).from('matches').update({
      score1: state.score1, score2: state.score2,
      sets_won1: state.setsWon1, sets_won2: state.setsWon2,
      current_set: state.currentSet, point_cap: pointCap, sets_to_win: setsToWin,
      status: state.matchDone ? 'completed' : 'in_progress',
    }).eq('id', matchId);

    if (error) {
      console.error('Failed to sync match state:', error);
      toast.error('Failed to sync match score to database');
    }
  };

  const syncMPs = async (sw1: number, sw2: number) => {
    if (matchId === 'test-match') return;

    const results = await Promise.all([
      p1MpId ? (supabase as any).from('match_players').update({ sets_won: sw1 }).eq('id', p1MpId) : null,
      p2MpId ? (supabase as any).from('match_players').update({ sets_won: sw2 }).eq('id', p2MpId) : null,
    ].filter(Boolean));

    if (results.some(res => res && res.error)) {
      console.error('Failed to sync match players');
      toast.error('Failed to sync player sets to database');
    }
  };

  const handleAction = async (playerId: string, finish: FinishType) => {
    if (!player1 || !player2 || matchDone || acting) return;
    setActing(true);

    // scorer_player_id = the fouling/scoring player (always the one whose button was tapped).
    // PEN points are awarded to the OPPONENT inside buildState() — this way the fouling
    // player's pen_count stat still increments correctly via the trigger.
    const beyId = playerId === player1.id ? selectedP1Bey : selectedP2Bey;

    const { error } = await (supabase as any).from('finish_events').insert({
      match_id: matchId, scorer_player_id: playerId,
      finish_type: finish.id, points: finish.points,
      set_number: currentSet, bey_id: beyId || null,
    });

    if (error) { toast.error('Failed to record action'); setActing(false); return; }

    if (match?.status === 'grabbed' || match?.status === 'pending') {
      await (supabase as any).from('matches').update({ status: 'in_progress' }).eq('id', matchId);
    }

    const newEvs = await fetchEvents();
    const prev = buildState(events, player1.id, pointCap, setsToWin);
    const next = buildState(newEvs, player1.id, pointCap, setsToWin);

    if (next.setsWon1 > prev.setsWon1 || next.setsWon2 > prev.setsWon2) {
      await syncMPs(next.setsWon1, next.setsWon2);
      toast.success(next.matchDone ? 'Match complete!' : `Set ${prev.currentSet} complete — Set ${next.currentSet}`, { duration: 3000 });
    }
    await syncMatch(next);
    setActing(false);
  };

  const handleUndo = async () => {
    if (events.length === 0 || acting) return;
    setActing(true);

    if (matchId === 'test-match') {
      const newEvs = events.slice(0, -1);
      setEvents(newEvs);
      const next = buildState(newEvs, player1!.id, pointCap, setsToWin);
      await syncMatch(next);
      toast('Undone');
      setActing(false);
      return;
    }

    const last = events[events.length - 1];
    const { error } = await (supabase as any).from('finish_events').delete().eq('id', last.id);
    if (error) { toast.error('Failed to undo'); setActing(false); return; }
    const newEvs = await fetchEvents();
    const next = buildState(newEvs, player1!.id, pointCap, setsToWin);
    await syncMatch(next);
    await syncMPs(next.setsWon1, next.setsWon2);
    toast('Undone');
    setActing(false);
  };

  const handleSubmit = async () => {
    if (!match || !player1 || !player2 || !ss) return;
    if (!window.confirm('Submit this match? Results will be final.')) return;
    setSubmitting(true);

    if (matchId === 'test-match') {
      toast.success('Test match submitted!');
      router.push('/referee');
      return;
    }

    const p1Wins  = setsWon1 >= setsToWin;
    const p1Total = events.filter(e => e.scorer_player_id === player1.id).reduce((s: number, e: any) => s + (e.points || 0), 0);
    const p2Total = events.filter(e => e.scorer_player_id === player2.id).reduce((s: number, e: any) => s + (e.points || 0), 0);

    const results = await Promise.all([
      (supabase as any).from('matches').update({ status: 'submitted', notes, score1, score2, sets_won1: setsWon1, sets_won2: setsWon2 }).eq('id', matchId),
      p1MpId ? (supabase as any).from('match_players').update({ total_points: p1Total, sets_won: setsWon1, winner: p1Wins  }).eq('id', p1MpId) : null,
      p2MpId ? (supabase as any).from('match_players').update({ total_points: p2Total, sets_won: setsWon2, winner: !p1Wins }).eq('id', p2MpId) : null,
    ].filter(Boolean));

    if (results.some(res => res && res.error)) {
      toast.error('Failed to submit match results');
      setSubmitting(false);
      return;
    }

    await (supabase as any).from('notifications').insert([
      { player_id: player1.id, type: 'match_result', message: `Match result: ${setsWon1}–${setsWon2} vs ${player2.display_name}`, link: `/players/${player1.username}` },
      { player_id: player2.id, type: 'match_result', message: `Match result: ${setsWon2}–${setsWon1} vs ${player1.display_name}`, link: `/players/${player2.username}` },
    ]);

    if (tournament?.discord_webhook_url) {
      fetch('/api/discord/webhook', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: tournament.discord_webhook_url, player1: player1.display_name, player2: player2.display_name, score: `${setsWon1}–${setsWon2}`, winner: p1Wins ? player1.display_name : player2.display_name, tournamentName: tournament.name, stage: match.stage }),
      }).catch((err) => {
        console.error('Failed to send Discord webhook:', err);
      });
    }

    toast.success('Match submitted!');
    router.push('/referee');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!match || !player1 || !player2) return <div className="p-12 text-center text-muted-foreground">Match not found</div>;

  const isFixedDecks = tournament?.stage_type === 'single' ? tournament?.stage1_fixed_decks : (match.stage === 'stage2' ? tournament?.stage2_fixed_decks : tournament?.stage1_fixed_decks);

  return (
    <div className="min-h-screen bg-[#0d0d14] flex flex-col text-white select-none">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/referee')} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft size={16} className="text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-primary/20 text-primary rounded-md">
              {match.stage || 'Match'}
            </span>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest hidden sm:block">
              {tournament?.name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchEvents} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <RefreshCw size={14} className="text-muted-foreground" />
          </button>
          <Link href={`/matches/${matchId}/live`} target="_blank" className="p-2 hover:bg-white/5 rounded-lg transition-colors hidden sm:block">
            <ExternalLink size={14} className="text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* ── Match complete banner ── */}
      <AnimatePresence>
        {matchDone && winnerId && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-primary/10 border-b border-primary/20 text-center py-3">
            <div className="flex items-center justify-center gap-2">
              <Trophy size={16} className="text-primary" />
              <span className="text-xs font-black uppercase tracking-widest italic text-primary">
                {winnerId === player1.id ? player1.display_name : player2.display_name} wins {setsWon1}–{setsWon2}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main scorer ── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* P1 panel */}
        <div className="flex-1 flex flex-col bg-[#111118] border-r border-white/5">
          {/* Player header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-[#1a1a28] flex-shrink-0">
                {player1.avatar_url
                  ? <img src={player1.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><User size={14} className="text-primary" /></div>}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest truncate max-w-[120px]">{player1.display_name}</span>
            </div>
            {/* Last action badge */}
            {lastP1Event && (
              <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 text-muted-foreground">
                {lastP1Event.finish_type}
              </span>
            )}
            {/* Current set score */}
            <span className="text-2xl font-black italic text-primary">{score1}</span>
          </div>

          {/* Bey selector */}
          {!isFixedDecks && p1Decks[0]?.decks && (
            <div className="px-4 pb-2">
              <select value={selectedP1Bey} onChange={e => setSelectedP1Bey(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest focus:outline-none focus:border-primary transition-colors">
                <option value="">Select Beyblade</option>
                <option value={(p1Decks[0].decks as any).bey1_id}>{(p1Decks[0].decks as any).bey1?.name || 'Bey 1'}</option>
                <option value={(p1Decks[0].decks as any).bey2_id}>{(p1Decks[0].decks as any).bey2?.name || 'Bey 2'}</option>
                <option value={(p1Decks[0].decks as any).bey3_id}>{(p1Decks[0].decks as any).bey3?.name || 'Bey 3'}</option>
              </select>
            </div>
          )}

          {/* Finish buttons */}
          <div className="flex-1 grid grid-cols-3 gap-2 p-4 content-center">
            {FINISH_TYPES.map((f) => (
              <FinishButton key={f.id} finish={f} disabled={matchDone || acting}
                onClick={() => handleAction(player1.id, f)} side="left" />
            ))}
          </div>

          {/* Sets control */}
          <div className="px-4 pb-4 flex items-center gap-3">
            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Sets</span>
            <button onClick={() => setSetsToWin(v => Math.max(1, v - 1))} className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <Minus size={10} />
            </button>
            <span className="text-sm font-black w-4 text-center">{setsToWin}</span>
            <button onClick={() => setSetsToWin(v => Math.min(5, v + 1))} className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <Plus size={10} />
            </button>
          </div>
        </div>

        {/* ── Center column ── */}
        <div className="flex flex-col items-center justify-center gap-4 px-4 py-6 min-w-[140px] md:min-w-[180px] bg-[#0d0d14]">
          {/* Sets won hearts */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-1.5">
              {Array.from({ length: setsToWin }).map((_, i) => (
                <Heart key={i} size={14} className={`transition-all ${i < setsWon1 ? 'text-primary fill-primary' : 'text-white/10'}`} />
              ))}
            </div>

            {/* Big scores */}
            <div className="flex items-center gap-3">
              <motion.span
                key={`s1-${score1}`}
                initial={{ scale: 1.4, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-6xl md:text-8xl font-black italic tabular-nums text-white"
              >
                {score1}
              </motion.span>
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-black italic text-white/20">VS</span>
                <button
                  onClick={handleUndo}
                  disabled={events.length === 0 || acting || submitting}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[8px] font-black uppercase tracking-widest text-muted-foreground transition-all disabled:opacity-30 active:scale-95"
                >
                  <Undo2 size={10} /> Undo
                </button>
              </div>
              <motion.span
                key={`s2-${score2}`}
                initial={{ scale: 1.4, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-6xl md:text-8xl font-black italic tabular-nums text-white"
              >
                {score2}
              </motion.span>
            </div>

            <div className="flex gap-1.5">
              {Array.from({ length: setsToWin }).map((_, i) => (
                <Heart key={i} size={14} className={`transition-all ${i < setsWon2 ? 'text-cyan-400 fill-cyan-400' : 'text-white/10'}`} />
              ))}
            </div>
          </div>

          <div className="text-[8px] font-black uppercase tracking-widest text-white/20">Sets Won</div>

          {/* Set indicator */}
          <div className="px-3 py-1 bg-white/5 rounded-full">
            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Set {currentSet}</span>
          </div>
        </div>

        {/* P2 panel */}
        <div className="flex-1 flex flex-col bg-[#111118] border-l border-white/5">
          {/* Player header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            {/* Current set score */}
            <span className="text-2xl font-black italic text-cyan-400">{score2}</span>
            {/* Last action badge */}
            {lastP2Event && (
              <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 text-muted-foreground">
                {lastP2Event.finish_type}
              </span>
            )}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest truncate max-w-[120px]">{player2.display_name}</span>
              <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-[#1a1a28] flex-shrink-0">
                {player2.avatar_url
                  ? <img src={player2.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><User size={14} className="text-cyan-400" /></div>}
              </div>
            </div>
          </div>

          {/* Bey selector */}
          {!isFixedDecks && p2Decks[0]?.decks && (
            <div className="px-4 pb-2">
              <select value={selectedP2Bey} onChange={e => setSelectedP2Bey(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest focus:outline-none focus:border-primary transition-colors">
                <option value="">Select Beyblade</option>
                <option value={(p2Decks[0].decks as any).bey1_id}>{(p2Decks[0].decks as any).bey1?.name || 'Bey 1'}</option>
                <option value={(p2Decks[0].decks as any).bey2_id}>{(p2Decks[0].decks as any).bey2?.name || 'Bey 2'}</option>
                <option value={(p2Decks[0].decks as any).bey3_id}>{(p2Decks[0].decks as any).bey3?.name || 'Bey 3'}</option>
              </select>
            </div>
          )}

          {/* Finish buttons */}
          <div className="flex-1 grid grid-cols-3 gap-2 p-4 content-center">
            {FINISH_TYPES.map((f) => (
              <FinishButton key={f.id} finish={f} disabled={matchDone || acting}
                onClick={() => handleAction(player2.id, f)} side="right" />
            ))}
          </div>

          {/* Cap control */}
          <div className="px-4 pb-4 flex items-center justify-end gap-3">
            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Cap</span>
            <button onClick={() => setPointCap(v => Math.max(1, v - 1))} className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <Minus size={10} />
            </button>
            <span className="text-sm font-black w-4 text-center">{pointCap}</span>
            <button onClick={() => setPointCap(v => Math.min(20, v + 1))} className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <Plus size={10} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-white/5 bg-[#0d0d14] px-4 py-4 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={12} className="text-muted-foreground" />
            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Match Feedback & Notes</span>
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add any feedback, penalties, or special notes about this match..."
            className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-primary/50 transition-colors min-h-[80px] resize-none text-white placeholder:text-white/20"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || acting}
          className="w-full py-4 bg-primary hover:bg-primary/90 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : 'Finish Match'}
        </button>
      </div>
    </div>
  );
}

// ── Finish button component ──────────────────────────────────
const FINISH_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  EXT: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', label: '+3' },
  OVR: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', label: '+2' },
  BUR: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', label: '+2' },
  SPN: { bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400',  label: '+1' },
  WRN: { bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400',  label: '+0' },
  PEN: { bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400',  label: '+1' },
};

function FinishButton({ finish, disabled, onClick, side }: { finish: FinishType; disabled: boolean; onClick: () => void; side: 'left' | 'right' }) {
  const c = FINISH_COLORS[finish.id] ?? FINISH_COLORS.EXT;
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.90 }}
      onClick={onClick}
      disabled={disabled}
      className={`
        relative flex flex-col items-center justify-center gap-0.5
        py-3 px-2 rounded-xl border ${c.bg} ${c.border}
        transition-all duration-150 overflow-hidden
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:brightness-125 active:scale-95 cursor-pointer'}
      `}
    >
      <span className={`text-sm md:text-base font-black italic ${c.text}`}>{finish.name}</span>
      <span className={`text-[8px] font-black uppercase tracking-widest ${c.text} opacity-70`}>{c.label}</span>
    </motion.button>
  );
}
