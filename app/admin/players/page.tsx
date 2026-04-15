'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Users, ArrowLeft, Search, Edit2, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';

export default function PlayersAdmin() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;
  const supabase = getSupabase();

  const fetchPlayers = async () => {
    setLoading(true);
    let query = supabase
      .from('players')
      .select('*', { count: 'exact' })
      .order('ranking_points', { ascending: false });

    if (searchQuery) {
      query = query.or(`display_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`);
    }

    const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      toast.error('Failed to load players');
      console.error(error);
    } else {
      setPlayers(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlayers();
  }, [supabase, page, searchQuery]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset to first page on search
  };

  const handleEdit = (player: any) => {
    setEditingId(player.id);
    setEditForm({
      username: player.username,
      display_name: player.display_name,
      email: player.email || '',
      club: player.club || '',
      region: player.region || '',
      ranking_points: player.ranking_points,
    });
  };

  const handleSave = async (id: string) => {
    try {
      const res = await fetch('/api/admin/players', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editForm }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update player');
      }

      toast.success('Player updated successfully');
      setEditingId(null);
      fetchPlayers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save player');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link 
        href="/admin" 
        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors mb-8"
      >
        <ArrowLeft size={14} />
        Back to Admin
      </Link>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
          <Users className="text-primary" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Player Management</h1>
          <p className="text-sm text-muted-foreground">Manage and edit player profiles</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-border bg-black/20">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search players by name or username..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 pl-12 text-sm font-bold focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-black/40">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Display Name</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Username / Email</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Club / Region</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ranking Pts</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading players...</td></tr>
              ) : players.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No players found.</td></tr>
              ) : (
                players.map((player) => (
                  <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={player.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      {editingId === player.id ? (
                        <input type="text" value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-bold focus:outline-none focus:border-primary" />
                      ) : (
                        <div className="font-bold italic">{player.display_name}</div>
                      )}
                    </td>
                    <td className="p-4">
                      {editingId === player.id ? (
                        <div className="space-y-2">
                          <input type="text" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-bold focus:outline-none focus:border-primary" />
                          <input type="email" placeholder="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-xs font-bold focus:outline-none focus:border-primary" />
                        </div>
                      ) : (
                        <div>
                          <div className="text-sm text-muted-foreground">@{player.username}</div>
                          <div className="text-[10px] text-muted-foreground/60">{player.email || 'No email'}</div>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {editingId === player.id ? (
                        <div className="flex gap-2">
                          <input type="text" placeholder="Club" value={editForm.club} onChange={(e) => setEditForm({ ...editForm, club: e.target.value })} className="w-1/2 bg-background border border-border rounded px-3 py-2 text-xs font-bold focus:outline-none focus:border-primary" />
                          <input type="text" placeholder="Region" value={editForm.region} onChange={(e) => setEditForm({ ...editForm, region: e.target.value })} className="w-1/2 bg-background border border-border rounded px-3 py-2 text-xs font-bold focus:outline-none focus:border-primary" />
                        </div>
                      ) : (
                        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{player.club || '-'} / {player.region || '-'}</div>
                      )}
                    </td>
                    <td className="p-4">
                      {editingId === player.id ? (
                        <input type="number" value={editForm.ranking_points} onChange={(e) => setEditForm({ ...editForm, ranking_points: parseInt(e.target.value) || 0 })} className="w-24 bg-background border border-border rounded px-3 py-2 text-sm font-black italic text-primary focus:outline-none focus:border-primary" />
                      ) : (
                        <div className="font-black italic text-primary">{player.ranking_points}</div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {editingId === player.id ? (
                        <div className="flex items-center justify-end gap-2"><button onClick={() => setEditingId(null)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"><X size={16} /></button><button onClick={() => handleSave(player.id)} className="p-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"><Save size={16} /></button></div>
                      ) : (
                        <button onClick={() => handleEdit(player)} className="p-2 text-muted-foreground hover:text-primary transition-colors"><Edit2 size={16} /></button>
                      )}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-6 border-t border-border bg-black/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} of {totalCount} players
            </p>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500" 
                style={{ width: `${(Math.min(page * pageSize, totalCount) / totalCount) * 100}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="p-2.5 bg-background border border-border rounded-xl disabled:opacity-30 hover:border-primary hover:text-primary transition-all active:scale-95"
              >
                <ChevronLeft size={18} />
              </button>
              
              <div className="flex items-center gap-1 px-4 py-2 bg-background border border-border rounded-xl">
                <span className="text-xs font-black italic text-primary">{page}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mx-1">of</span>
                <span className="text-xs font-black italic">{Math.ceil(totalCount / pageSize) || 1}</span>
              </div>

              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * pageSize >= totalCount || loading}
                className="p-2.5 bg-background border border-border rounded-xl disabled:opacity-30 hover:border-primary hover:text-primary transition-all active:scale-95"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}