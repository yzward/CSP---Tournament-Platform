'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Trophy, Link2, ChevronLeft, Download, List, RefreshCw, User, CheckCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { parseTournamentId } from '@/lib/challonge';

export default function ImportTournament() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [importSteps, setImportSteps] = useState<{label: string, status: 'pending' | 'loading' | 'success' | 'error'}[]>([
    { label: 'Fetch Challonge Data', status: 'pending' },
    { label: 'Initialize Tournament', status: 'pending' },
    { label: 'Sync Participants', status: 'pending' },
    { label: 'Generate Match List', status: 'pending' }
  ]);
  const [challongeUrl, setChallongeUrl] = useState('');
  const [userTournaments, setUserTournaments] = useState<any[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [organiserId, setOrganiserId] = useState('');
  const [players, setPlayers] = useState<any[]>([]);
  
  const supabase = getSupabase();

  const updateStep = (index: number, status: 'pending' | 'loading' | 'success' | 'error') => {
    setImportSteps(prev => prev.map((step, i) => i === index ? { ...step, status } : step));
  };

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const res = await fetch('/api/challonge/tournaments.json?state=open');
        if (res.ok) {
          const data = await res.json();
          setUserTournaments(data.map((item: any) => item.tournament) || []);
        }
      } catch (err) {
        console.error('Failed to fetch user tournaments', err);
      } finally {
        setLoadingTournaments(false);
      }
    };

    const fetchPlayers = async () => {
      try {
        const { data: playersData } = await supabase.from('players').select('id, display_name').order('display_name');
        if (playersData) {
          setPlayers(playersData);
        }
      } catch (err) {
        console.error('Failed to fetch players', err);
      }
    };

    fetchTournaments();
    fetchPlayers();
  }, [supabase]);

  const handleImportChallonge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challongeUrl) {
      toast.error('Please enter a Challonge tournament URL or ID');
      return;
    }
    
    setLoading(true);
    setImportSteps([
      { label: 'Fetch Challonge Data', status: 'loading' },
      { label: 'Initialize Tournament', status: 'pending' },
      { label: 'Sync Participants', status: 'pending' },
      { label: 'Generate Match List', status: 'pending' }
    ]);

    try {
      const { id: tournamentId } = parseTournamentId(challongeUrl);

      // Step 1: Fetch
      const response = await fetch(`/api/challonge/tournaments/${tournamentId}.json`);
      const result = await response.json();
      
      if (!response.ok) {
        updateStep(0, 'error');
        throw new Error(result.error || 'Failed to fetch from Challonge');
      }
      updateStep(0, 'success');
      updateStep(1, 'loading');

      const tournament = result.tournament;

      // Step 2: Create
      const { data: newTournament, error } = await (supabase as any)
        .from('tournaments')
        .insert({ 
          name: tournament.name, 
          held_at: new Date(tournament.started_at || tournament.created_at).toISOString().split('T')[0], 
          format: tournament.tournament_type === 'single elimination' ? 'single_elim' : 
                  tournament.tournament_type === 'double elimination' ? 'double_elim' : 
                  tournament.tournament_type === 'round robin' ? 'round_robin' : 'swiss',
          stage1_format: tournament.tournament_type === 'single elimination' ? 'single_elim' : 
                         tournament.tournament_type === 'double elimination' ? 'double_elim' : 
                         tournament.tournament_type === 'round robin' ? 'round_robin' : 'swiss',
          status: 'active',
          evaroon_id: tournament.url,
          location: 'Offline',
          description: tournament.description || '',
          organiser_id: organiserId || null
        })
        .select()
        .single();

      if (error) {
        updateStep(1, 'error');
        throw error;
      }
      updateStep(1, 'success');
      updateStep(2, 'loading');

      // Step 3 & 4: Sync
      const syncRes = await fetch('/api/challonge/sync-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: newTournament.id })
      });

      if (!syncRes.ok) {
        updateStep(2, 'error');
        updateStep(3, 'error');
        const syncData = await syncRes.json();
        throw new Error(syncData.error || 'Sync failed');
      }
      
      updateStep(2, 'success');
      updateStep(3, 'success');

      toast.success('Tournament imported and synced successfully!');
      setTimeout(() => router.push('/operations'), 1500);
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/operations" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white mb-8 transition-colors">
        <ChevronLeft size={14} /> Back to Operations
      </Link>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
          <Trophy className="text-primary" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight italic">
            Import Tournament
          </h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Connect with Challonge
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-3xl p-8 shadow-2xl"
      >
        <form onSubmit={handleImportChallonge} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select from your open tournaments</label>
              <button 
                type="button"
                onClick={async () => {
                  setLoadingTournaments(true);
                  try {
                    const res = await fetch('/api/challonge/tournaments.json?state=open');
                    if (res.ok) {
                      const data = await res.json();
                      setUserTournaments(data.map((item: any) => item.tournament) || []);
                      toast.success('Tournaments refreshed');
                    }
                  } catch (err) {
                    toast.error('Failed to refresh tournaments');
                  } finally {
                    setLoadingTournaments(false);
                  }
                }}
                className="text-[8px] font-black uppercase tracking-widest text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={10} className={loadingTournaments ? 'animate-spin' : ''} />
                Refresh List
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <List size={16} className="text-muted-foreground" />
              </div>
              <select
                onChange={(e) => setChallongeUrl(e.target.value)}
                value={userTournaments.find(t => t.url === challongeUrl) ? challongeUrl : ''}
                className="w-full bg-background border border-border rounded-xl pl-11 pr-10 py-4 text-xs font-bold focus:outline-none focus:border-primary transition-colors appearance-none disabled:opacity-50"
                disabled={loadingTournaments}
              >
                <option value="">{loadingTournaments ? 'Loading tournaments...' : userTournaments.length === 0 ? 'No open tournaments found' : 'Select a tournament...'}</option>
                {userTournaments.map((t) => (
                  <option key={t.id} value={t.url}>
                    {t.name} ({new Date(t.started_at || t.created_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <ChevronLeft size={16} className="text-muted-foreground -rotate-90" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 py-2">
            <div className="h-px bg-border flex-1"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">OR PASTE URL</span>
            <div className="h-px bg-border flex-1"></div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Challonge Tournament URL or ID</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Link2 size={16} className="text-muted-foreground" />
              </div>
              <input
                type="text"
                required
                value={challongeUrl}
                onChange={(e) => setChallongeUrl(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                placeholder="e.g., my_tournament or https://challonge.com/..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tournament Organizer</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User size={16} className="text-muted-foreground" />
              </div>
              <select
                value={organiserId}
                onChange={(e) => setOrganiserId(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-11 pr-10 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors appearance-none"
              >
                <option value="">Select an organizer (optional)</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <ChevronLeft size={16} className="text-muted-foreground -rotate-90" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <RefreshCw size={16} className="animate-spin" />
                <span>Processing Import...</span>
              </div>
            ) : (
              <><Download size={16} /> Import from Challonge</>
            )}
          </button>

          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-6 space-y-3"
              >
                {importSteps.map((step, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 bg-background border border-border rounded-xl">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      step.status === 'loading' ? 'text-primary' : 
                      step.status === 'success' ? 'text-green-500' : 
                      step.status === 'error' ? 'text-red-500' : 'text-muted-foreground'
                    }`}>
                      {step.label}
                    </span>
                    {step.status === 'loading' && <RefreshCw size={12} className="animate-spin text-primary" />}
                    {step.status === 'success' && <CheckCircle size={12} className="text-green-500" />}
                    {step.status === 'error' && <XCircle size={12} className="text-red-500" />}
                    {step.status === 'pending' && <div className="w-3 h-3 rounded-full border-2 border-border" />}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </motion.div>
    </div>
  );
}
