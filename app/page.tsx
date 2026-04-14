'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Shield, Trophy, Users, Zap, ArrowRight,
  Disc as Discord, Activity, X, Star,
  ChevronRight, Swords, TrendingUp, Globe
} from 'lucide-react';
import { motion } from 'motion/react';
import { getSupabase } from '@/lib/supabase';

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ value }: { value: number }) {
  const [count, setCount] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    let start = 0;
    const step = (value / 1600) * 16;
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setCount(value); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  if (!isMounted) return <>0</>;
  return <>{count.toLocaleString()}</>;
}

// ── Mock match card ───────────────────────────────────────────────────────────
function MockMatchCard({ p1, p2, score, status }: { p1: string; p2: string; score: string; status: 'live' | 'done' }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#0f0f1a]/80 rounded-xl border border-white/6">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status === 'live' ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
      <div className="flex-1 flex items-center justify-between min-w-0">
        <span className="text-xs font-semibold text-white/80 truncate">{p1}</span>
        <span className="text-[11px] font-black text-primary px-2 flex-shrink-0">{score}</span>
        <span className="text-xs font-semibold text-white/80 truncate text-right">{p2}</span>
      </div>
    </div>
  );
}

// ── Hero dashboard card ───────────────────────────────────────────────────────
function HeroCard({ topPlayers }: { topPlayers: any[] }) {
  const placeholders = [
    { display_name: '—', ranking_points: 0 },
    { display_name: '—', ranking_points: 0 },
    { display_name: '—', ranking_points: 0 },
  ];
  const players = topPlayers.length > 0 ? topPlayers.slice(0, 3) : placeholders;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-[340px] mx-auto lg:mx-0"
    >
      {/* Glow */}
      <div className="absolute -inset-6 bg-primary/10 blur-[60px] rounded-full pointer-events-none" />

      {/* Card shell */}
      <div className="relative bg-[#13131f] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Card header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">ClashStats</span>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-green-400/80">Live</span>
          </div>
        </div>

        {/* Rankings */}
        <div className="px-5 pt-4 pb-3">
          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Top Bladers</div>
          <div className="space-y-2">
            {players.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`text-[11px] font-black w-4 flex-shrink-0 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-400' : 'text-white/25'}`}>
                  {i + 1}
                </span>
                <div className="w-7 h-7 rounded-full overflow-hidden border border-white/10 bg-primary/15 flex-shrink-0 flex items-center justify-center">
                  {p.avatar_url
                    ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[10px] font-black text-primary">{p.display_name?.[0] || '?'}</span>}
                </div>
                <span className="flex-1 text-xs font-semibold text-white/80 truncate">{p.display_name}</span>
                <span className="text-[11px] font-black text-primary flex-shrink-0">{(p.ranking_points ?? 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/6 mx-5" />

        {/* Recent matches */}
        <div className="px-5 pt-3 pb-4">
          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Recent Matches</div>
          <div className="space-y-2">
            <MockMatchCard p1="KAIRO" p2="STORM" score="3 – 1" status="done" />
            <MockMatchCard p1="VEXUS" p2="BLAZE" score="2 – 2" status="live" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, delay }: { label: string; value: number; icon: any; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      className="bg-[#13131f] border border-white/8 rounded-2xl px-6 py-5 flex items-center gap-4"
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-primary" />
      </div>
      <div>
        <div className="text-2xl font-black text-white leading-none mb-0.5">
          <Counter value={value} />
        </div>
        <div className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">{label}</div>
      </div>
    </motion.div>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Trophy,
    title: 'Tournament Engine',
    body: 'Swiss, Round Robin, Single & Double Elimination. Auto-seeding by ranking. Bracket preview before you generate.',
  },
  {
    icon: Zap,
    title: 'Live Scoring',
    body: 'Referees grab and score matches in real-time. Every EXT, OVR, BUR, SPN finish logged per beyblade.',
  },
  {
    icon: TrendingUp,
    title: 'Global Rankings',
    body: 'Points awarded automatically on tournament completion. Head-to-head records and meta stats per part.',
  },
];

// ── Main landing content ──────────────────────────────────────────────────────
function LandingContent() {
  const [stats, setStats] = useState({ bladers: 0, tournaments: 0, matches: 0 });
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const supabase = getSupabase();
  const searchParams = useSearchParams();
  const [errorParam, setErrorParam] = useState(searchParams.get('error'));
  const [showError, setShowError] = useState(!!errorParam);
  const discordInviteUrl = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || 'https://discord.gg/spiritgaming';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const [players, tournaments, matches, top] = await Promise.all([
        supabase.from('players').select('id', { count: 'exact', head: true }),
        supabase.from('tournaments').select('id', { count: 'exact', head: true }),
        supabase.from('matches').select('id', { count: 'exact', head: true }),
        supabase.from('players').select('*').order('ranking_points', { ascending: false }).limit(3),
      ]);
      setStats({ bladers: players.count || 0, tournaments: tournaments.count || 0, matches: matches.count || 0 });
      setTopPlayers(top.data || []);
    };
    fetchData();
  }, [supabase]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) return;
      
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        checkUser();
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        if (event.data.error === 'not_member') {
          setErrorParam('not_member');
          setShowError(true);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [supabase]);

  const checkUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;
    const { data: player } = await supabase.from('players').select('id').eq('discord_id', user.id).single();
    if (player) {
      // players table has no status column — if the record exists the player is approved
      const { data: userRoles } = await supabase.from('user_roles').select('roles(name)').eq('player_id', player.id);
      const roles = userRoles?.map((r: any) => r.roles?.name) || [];
      if (roles.includes('Admin')) window.location.href = '/admin';
      else if (roles.includes('Ops')) window.location.href = '/operations';
      else if (roles.includes('Referee')) window.location.href = '/referee';
      else window.location.href = '/rankings';
    } else {
      window.location.href = '/claim';
    }
  };

  useEffect(() => {
    checkUser();
  }, [supabase]);

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { 
        redirectTo: `${window.location.origin}/auth/callback`, 
        scopes: 'identify email guilds',
        skipBrowserRedirect: true,
      },
    });
    
    if (data?.url) {
      window.open(data.url, 'oauth_popup', 'width=600,height=700');
    }
  };

  if (!isMounted) {
    return <div className="min-h-screen bg-[#0a0a14]" />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white overflow-x-hidden">

      {/* ── NAV ──────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/6 bg-[#0a0a14]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Swords size={14} className="text-white" />
            </div>
            <span className="font-bold text-sm text-white tracking-tight">ClashStats<span className="text-primary">Pro</span></span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {[['Rankings', '/rankings'], ['Tournaments', '/tournaments'], ['Meta', '/meta']].map(([label, href]) => (
              <Link key={href} href={href}
                className="px-4 py-2 text-xs font-semibold text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                {label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <button onClick={handleLogin}
            className="flex items-center gap-2 px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold rounded-lg transition-all">
            <Discord size={14} />
            <span>Login</span>
          </button>
        </div>
      </header>

      {/* ── ERROR BANNER ─────────────────────────────────────────── */}
      {showError && errorParam === 'not_member' && (
        <div className="fixed top-14 left-0 right-0 z-40 bg-red-500/10 border-b border-red-500/20 px-6 py-3 flex items-center gap-4">
          <Shield size={14} className="text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-300/80 flex-1">
            You must be a member of the Clash League Discord to access ClashStatsPro.
          </p>
          <a href={discordInviteUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors flex-shrink-0">
            Join Discord
          </a>
          <button onClick={() => setShowError(false)} className="text-white/30 hover:text-white transition-colors ml-2">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-16 px-6 overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-0 right-1/3 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-violet-800/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left */}
          <div>
            {/* Badge */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold text-primary/90 uppercase tracking-widest">Spirit Gaming — Official Rankings</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6"
            >
              The home of<br />competitive<br />
              <span className="text-primary">Beyblade X</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
              className="text-white/45 text-sm leading-relaxed mb-8 max-w-md">
              Tournament management, live match scoring, and global rankings — all in one place. Built for the Spirit Gaming Beyblade X community.
            </motion.p>

            {/* CTAs */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleLogin}
                className="group flex items-center justify-center gap-2.5 px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20">
                <Discord size={16} />
                Login with Discord
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
              <Link href="/tournaments"
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/8 text-white/70 hover:text-white text-sm font-semibold rounded-xl transition-all">
                Browse Tournaments
                <ChevronRight size={14} />
              </Link>
            </motion.div>
          </div>

          {/* Right: mock dashboard card */}
          <div className="flex justify-center lg:justify-end">
            <HeroCard topPlayers={topPlayers} />
          </div>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────── */}
      <section className="px-6 pb-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Registered Bladers" value={stats.bladers} icon={Users} delay={0} />
          <StatCard label="Tournaments Run" value={stats.tournaments} icon={Trophy} delay={0.08} />
          <StatCard label="Matches Played" value={stats.matches} icon={Swords} delay={0.16} />
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section className="px-6 py-16 border-t border-white/6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mb-10">
            <div className="text-[10px] font-bold text-primary/70 uppercase tracking-widest mb-2">Platform Features</div>
            <h2 className="text-2xl md:text-3xl font-black text-white">Everything you need to run events</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="bg-[#13131f] border border-white/8 hover:border-primary/25 rounded-2xl p-6 group transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <f.icon size={18} className="text-primary" />
                </div>
                <h3 className="font-bold text-white text-base mb-2">{f.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOP PLAYERS ──────────────────────────────────────────── */}
      {topPlayers.length > 0 && (
        <section className="px-6 py-16 border-t border-white/6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <div className="text-[10px] font-bold text-primary/70 uppercase tracking-widest mb-2">Season Leaders</div>
                <h2 className="text-2xl md:text-3xl font-black text-white">Top Ranked Bladers</h2>
              </div>
              <Link href="/rankings"
                className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-white/40 hover:text-primary transition-colors group">
                View All
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {topPlayers.map((player, i) => (
                <motion.div key={player.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-[#13131f] border border-white/8 hover:border-primary/25 rounded-2xl p-5 flex items-center gap-4 group transition-all"
                >
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-xl overflow-hidden border ${i === 0 ? 'border-amber-500/40' : 'border-white/10'} bg-primary/10 flex items-center justify-center`}>
                      {player.avatar_url
                        ? <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <Users size={18} className="text-primary" />}
                    </div>
                    <span className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      i === 0 ? 'bg-amber-500 text-amber-950' : i === 1 ? 'bg-slate-500 text-white' : 'bg-white/10 text-white/60'
                    }`}>
                      {i + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-sm truncate group-hover:text-primary transition-colors">{player.display_name}</div>
                    <div className="text-[10px] text-white/35 mt-0.5">{player.region || 'Global'}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-black text-primary leading-none">{(player.ranking_points ?? 0).toLocaleString()}</div>
                    <div className="text-[9px] text-white/25 uppercase tracking-wider mt-0.5">pts</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-4 md:hidden text-center">
              <Link href="/rankings" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                View Full Rankings →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="px-6 py-20 border-t border-white/6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-[#13131f] border border-primary/20 rounded-3xl px-8 py-12 md:px-16 md:py-14 relative overflow-hidden text-center"
          >
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-primary/8 blur-[80px] rounded-full pointer-events-none" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full mb-6">
                <Globe size={12} className="text-primary" />
                <span className="text-[10px] font-bold text-primary/90 uppercase tracking-widest">Ready to Compete?</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                Join the official circuit
              </h2>
              <p className="text-white/40 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                Link your Discord account to access live tournaments, track your ranking, and compete for the top spot in the Spirit Gaming Beyblade X league.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={handleLogin}
                  className="group flex items-center gap-2.5 px-7 py-3.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20">
                  <Discord size={16} />
                  Login with Discord
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
                <Link href="/tournaments"
                  className="flex items-center gap-2 px-7 py-3.5 bg-white/5 hover:bg-white/10 border border-white/8 text-white/60 hover:text-white text-sm font-semibold rounded-xl transition-all">
                  Browse Events
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="border-t border-white/6 px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
              <Swords size={10} className="text-primary" />
            </div>
            <span className="text-xs font-semibold text-white/25">ClashStatsPro · Spirit Gaming</span>
          </div>
          <div className="flex items-center gap-6">
            {[['Rankings', '/rankings'], ['Tournaments', '/tournaments'], ['Meta', '/meta']].map(([label, href]) => (
              <Link key={href} href={href} className="text-xs font-semibold text-white/25 hover:text-white/60 transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a14]" />}>
      <LandingContent />
    </Suspense>
  );
}
