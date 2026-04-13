'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Tournament } from '@/types';
import { Trophy, Layout, List, BarChart3, ChevronLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import BracketViewer from '@/components/BracketViewer';

export default function TournamentBracketStandalone({ params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = use(params);
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [activeTab, setActiveTab] = useState<'bracket' | 'results' | 'standings'>('bracket');

  const supabase = getSupabase();

  useEffect(() => {
    const fetchTournamentData = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (data) setTournament(data);
      setLoading(false);
    };

    fetchTournamentData();
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-2xl font-bold">Tournament not found</h2>
        <Link href="/rankings" className="text-primary hover:underline mt-4 inline-block">Back to Rankings</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] pb-32">
      {/* Header */}
      <div className="relative h-[40vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-[#0f0f1a]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
        
        <div className="relative z-10 text-center px-4">
          <Link
            href={`/tournaments/${tournamentId}`}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6 group"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Back to Tournament</span>
          </Link>
          <h1 className="text-6xl md:text-8xl font-bold italic uppercase tracking-tighter mb-4 text-white">
            {tournament.name}
          </h1>
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
              <Trophy size={14} /> {tournament.stage1_format?.replace('_', ' ')}
            </div>
            <div className="w-1 h-1 rounded-full bg-white/20" />
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {new Date(tournament.held_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 -mt-12 relative z-20">
        <div className="bg-card/80 backdrop-blur-xl border border-white/5 rounded-3xl p-2 flex gap-2 mb-12 shadow-2xl">
          {[
            { id: 'bracket', icon: Layout, label: 'Bracket' },
            { id: 'results', icon: List, label: 'Results' },
            { id: 'standings', icon: BarChart3, label: 'Standings' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all ${
                activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-white/5'
              }`}
            >
              <tab.icon size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {activeTab === 'bracket' && (
              <div className="bg-card border border-white/5 rounded-[3rem] overflow-hidden">
                <BracketViewer tournamentId={tournamentId} />
              </div>
            )}

            {activeTab === 'results' && (
              <div className="bg-card border border-white/5 rounded-[3rem] p-20 text-center">
                <List className="mx-auto text-muted-foreground/20 mb-6" size={64} />
                <h3 className="text-2xl font-bold italic uppercase mb-2">Match Results</h3>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Coming soon</p>
              </div>
            )}

            {activeTab === 'standings' && (
              <div className="bg-card border border-white/5 rounded-[3rem] p-20 text-center">
                <BarChart3 className="mx-auto text-muted-foreground/20 mb-6" size={64} />
                <h3 className="text-2xl font-bold italic uppercase mb-2">Final Standings</h3>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Coming soon</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
