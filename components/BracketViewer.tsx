'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Bracket } from '@/types';
import { Layout, Maximize2, Loader2 } from 'lucide-react';
import 'brackets-viewer/dist/brackets-viewer.min.css';

export default function BracketViewer({ tournamentId }: { tournamentId: string }) {
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();

  useEffect(() => {
    const fetchBracket = async () => {
      const { data } = await supabase
        .from('brackets')
        .select('*')
        .eq('tournament_id', tournamentId)
        .single();
      
      if (data) setBracket(data);
      setLoading(false);
    };

    fetchBracket();

    const channel = supabase
      .channel(`bracket-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'brackets', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => setBracket(payload.new as Bracket)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  useEffect(() => {
    if (bracket?.data) {
      renderBracket();
    }
  }, [bracket]);

  const renderBracket = async () => {
    if (typeof window === 'undefined' || !bracket?.data) return;

    const container = document.getElementById('bracket-container');
    if (!container) return;

    try {
      await import('brackets-viewer/dist/brackets-viewer.min.js' as any);
      const viewer = (window as any).bracketsViewer;

      // brackets-manager stageData uses: stage, match, match_game, participant
      // brackets-viewer render() expects those exact keys
      const raw = bracket.data as any;

      await viewer.render(
        {
          stages:       raw.stage       ?? [],
          matches:      raw.match       ?? [],
          matchGames:   raw.match_game  ?? [],
          participants: raw.participant ?? [],
        },
        {
          selector: '#bracket-container',
          clear: true,
        }
      );
    } catch (err) {
      console.error('Failed to render bracket:', err);
    }
  };

  if (loading) return <div className="flex items-center justify-center p-20"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  if (!bracket) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <Layout className="text-muted-foreground mb-4 opacity-20" size={48} />
        <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No bracket generated for this tournament yet</p>
      </div>
    );
  }

  return (
    <div className="relative group min-h-[600px] flex flex-col">
      <div className="flex items-center justify-between p-8 border-b border-white/5">
        <h2 className="text-xl font-bold italic uppercase tracking-tight flex items-center gap-3">
          <Layout className="text-primary" size={24} /> Live <span className="text-primary">Bracket</span>
        </h2>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-500 rounded-full border border-green-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[8px] font-black uppercase tracking-widest">Live Updates</span>
        </div>
      </div>

      <div className="flex-1 relative overflow-auto custom-scrollbar p-8">
        <div id="bracket-container" className="brackets-viewer brackets-viewer-dark" />
      </div>

      <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-black/50 backdrop-blur-md p-3 rounded-xl border border-white/10 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest">
          <Maximize2 size={14} /> Pinch to zoom • Scroll to pan
        </div>
      </div>

      <style jsx global>{`
        .brackets-viewer-dark {
          --bracket-bg: transparent;
          --match-bg: rgba(255, 255, 255, 0.03);
          --match-border: rgba(255, 255, 255, 0.05);
          --match-hover-bg: rgba(255, 255, 255, 0.05);
          --match-hover-border: #8b5cf6;
          --text-color: #fff;
          --text-muted: #94a3b8;
          --primary: #8b5cf6;
          --win-color: #10b981;
          --loss-color: #ef4444;
        }
        .brackets-viewer { font-family: inherit !important; }
        .match {
          background: var(--match-bg) !important;
          border: 1px solid var(--match-border) !important;
          border-radius: 1rem !important;
          transition: all 0.3s ease !important;
        }
        .match:hover {
          border-color: var(--primary) !important;
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.1) !important;
        }
        .participant {
          padding: 0.75rem 1rem !important;
          border-bottom: 1px solid var(--match-border) !important;
        }
        .participant:last-child { border-bottom: none !important; }
        .participant .name {
          font-size: 0.75rem !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
        }
        .participant .score {
          font-family: monospace !important;
          font-weight: 900 !important;
          color: var(--primary) !important;
        }
        .connector { border-color: var(--match-border) !important; }
      `}</style>
    </div>
  );
}
