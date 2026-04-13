'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Trophy, Link2, ChevronLeft, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

export default function CreateTournament() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [startggSlug, setStartggSlug] = useState('');
  
  const supabase = getSupabase();

  const handleImportStartgg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startggSlug) {
      toast.error('Please enter a start.gg tournament slug');
      return;
    }
    
    setLoading(true);
    try {
      // Clean up the slug if they pasted a full URL
      let slug = startggSlug;
      if (slug.includes('start.gg/tournament/')) {
        slug = slug.split('start.gg/tournament/')[1].split('/')[0];
      }

      // Fetch tournament details from our secure API route
      const response = await fetch('/api/startgg/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch from start.gg');
      }

      const tournament = result.tournament;

      // Create the tournament in our database
      const { data: newTournament, error } = await (supabase as any)
        .from('tournaments')
        .insert({ 
          name: tournament.name, 
          held_at: new Date(tournament.startAt * 1000).toISOString().split('T')[0], 
          format: 'swiss',
          status: 'active',
          evaroon_id: tournament.slug || tournament.url || tournament.id.toString(), // Store the start.gg slug/url
          location: tournament.city || ''
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
          <h1 className="text-3xl font-black uppercase tracking-tight italic">Import Tournament</h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Connect with start.gg</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-3xl p-8"
      >
        <form onSubmit={handleImportStartgg} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Start.gg Tournament Slug or URL</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Link2 size={16} className="text-muted-foreground" />
              </div>
              <input
                type="text"
                required
                value={startggSlug}
                onChange={(e) => setStartggSlug(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                placeholder="e.g., my-awesome-tournament or https://start.gg/tournament/..."
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 ml-1">
              We will import the tournament details and automatically sync the bracket and matches.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Importing...' : <><Download size={16} /> Import from start.gg</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
