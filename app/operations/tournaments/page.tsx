'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Trophy, Link2, ChevronLeft, Download, List, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { parseTournamentId } from '@/lib/challonge';

export default function CreateTournament() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [challongeUrl, setChallongeUrl] = useState('');
  const [userTournaments, setUserTournaments] = useState<any[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  
  const supabase = getSupabase();

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
    fetchTournaments();
  }, []);

  const handleImportChallonge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challongeUrl) {
      toast.error('Please enter a Challonge tournament URL or ID');
      return;
    }
    
    setLoading(true);
    try {
      const { id: tournamentId } = parseTournamentId(challongeUrl);

      // Fetch tournament details from our proxy API route
      const response = await fetch(`/api/challonge/tournaments/${tournamentId}.json`);
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch from Challonge');
      }

      const tournament = result.tournament;

      // Create the tournament in our database
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
          description: tournament.description || ''
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Tournament imported successfully!');
      router.push('/operations');
    } catch (error: any) {
      toast.error(`Failed to import: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'import' | 'create'>('import');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    date: new Date().toISOString().split('T')[0],
    organizationId: '',
    gameId: '1', // Default to 1
    format: 'single_elim',
    location: 'Online',
    top_cut_size: '',
    organiser_id: ''
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: playersData } = await supabase.from('players').select('id, display_name').order('display_name');

        if (playersData) {
          setPlayers(playersData);
        }
      } catch (err) {
        console.error('Failed to fetch initial data', err);
      }
    };
    fetchInitialData();
  }, [supabase]);

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: newTournament, error: dbError } = await supabase
        .from('tournaments')
        .insert({
          name: formData.name,
          held_at: formData.date,
          format: formData.format,
          stage1_format: formData.format,
          status: 'active',
          evaroon_id: formData.slug,
          location: formData.location,
          top_cut_size: formData.top_cut_size ? parseInt(formData.top_cut_size) : null,
          organiser_id: formData.organiser_id || null
        })
        .select()
        .single();

      if (dbError) throw dbError;

      toast.success('Tournament created locally!');
      router.push('/operations');
    } catch (error: any) {
      toast.error(`Failed to create: ${error.message}`);
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
            {activeTab === 'import' ? 'Import Tournament' : 'Create Tournament'}
          </h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            {activeTab === 'import' ? 'Connect with Challonge' : 'Launch on Challonge'}
          </p>
        </div>
      </div>

      <div className="flex bg-card border border-border rounded-xl p-1 mb-8">
        <button
          onClick={() => setActiveTab('import')}
          className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'import' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white'
          }`}
        >
          Import Existing
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'create' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white'
          }`}
        >
          Create New
        </button>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-3xl p-8 shadow-2xl"
      >
        {activeTab === 'import' ? (
          <form onSubmit={handleImportChallonge} className="space-y-6">
            {/* ... existing import form ... */}
            {userTournaments.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Select from your tournaments</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <List size={16} className="text-muted-foreground" />
                  </div>
                  <select
                    onChange={(e) => setChallongeUrl(e.target.value)}
                    value={userTournaments.find(t => t.url === challongeUrl) ? challongeUrl : ''}
                    className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors appearance-none"
                  >
                    <option value="" disabled>Select a tournament...</option>
                    {userTournaments.map((t) => (
                      <option key={t.id} value={t.url}>
                        {t.name} ({new Date(t.started_at || t.created_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Importing...' : <><Download size={16} /> Import from Challonge</>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreateTournament} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tournament Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                  placeholder="e.g., Summer Clash 2024"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">URL Slug</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                  placeholder="e.g., summer-clash-2024"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Format</label>
                <select
                  required
                  value={formData.format}
                  onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors appearance-none"
                >
                  <option value="single_elim">Single Elimination</option>
                  <option value="double_elim">Double Elimination</option>
                  <option value="swiss">Swiss</option>
                  <option value="round_robin">Round Robin</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Location</label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                  placeholder="e.g., Online or London, UK"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Organizer</label>
                <select
                  value={formData.organiser_id}
                  onChange={(e) => setFormData({ ...formData, organiser_id: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors appearance-none"
                >
                  <option value="">Select an organizer (optional)</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {formData.format === 'double_elim' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Top Cut Size</label>
                <input
                  type="number"
                  value={formData.top_cut_size}
                  onChange={(e) => setFormData({ ...formData, top_cut_size: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                  placeholder="Number of players advancing to top cut"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Creating...' : <><Plus size={16} /> Create Local Tournament</>}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
