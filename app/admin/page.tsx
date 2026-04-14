'use client';

import { Shield, Users, UserCog, Award, Settings, Check, X, Clock, ExternalLink, Edit3 } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { AccountClaim } from '@/types';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalPlayers: 0,
    totalTournaments: 0,
    pendingClaims: 0,
  });
  const [claims, setClaims] = useState<AccountClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();

  const fetchStatsAndClaims = async () => {
    const [players, tournaments, pendingClaimsRes, claimsData] = await Promise.all([
      supabase.from('players').select('id', { count: 'exact', head: true }),
      supabase.from('tournaments').select('id', { count: 'exact', head: true }),
      supabase.from('account_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('account_claims').select('*, player:players(*)').eq('status', 'pending').order('created_at', { ascending: false })
    ]);

    setStats({
      totalPlayers: players.count || 0,
      totalTournaments: tournaments.count || 0,
      pendingClaims: pendingClaimsRes.count || 0,
    });
    setClaims(claimsData.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchStatsAndClaims();

    // Subscribe to real-time updates
    const claimsSubscription = supabase
      .channel('admin_claims')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_claims' }, () => {
        fetchStatsAndClaims();
      })
      .subscribe();

    return () => {
      claimsSubscription.unsubscribe();
    };
  }, [supabase]);

  const handleApproveClaim = async (claim: AccountClaim) => {
    try {
      const res = await fetch('/api/admin/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', claimId: claim.id, playerId: claim.player_id, authUserId: claim.auth_user_id })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve claim');
      }

      toast.success('Claim approved successfully');
      fetchStatsAndClaims();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve claim');
    }
  };

  const handleDenyClaim = async (claimId: string) => {
    try {
      const res = await fetch('/api/admin/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deny', claimId })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to deny claim');
      }

      toast.success('Claim denied');
      fetchStatsAndClaims();
    } catch (error: any) {
      toast.error(error.message || 'Failed to deny claim');
    }
  };

  const cards = [
    {
      title: 'Player Management',
      description: 'Approve, reject, and manage player profiles.',
      icon: Users,
      href: '/admin/players',
    },
    {
      title: 'Role Management',
      description: 'Assign roles and manage permissions.',
      icon: UserCog,
      href: '/admin/roles',
    },
    {
      title: 'Points Scale',
      description: 'Edit the tournament placement points scale.',
      icon: Award,
      href: '/admin/points',
    },
    {
      title: 'Content Management',
      description: 'Edit site text, headlines, and feature descriptions.',
      icon: Edit3,
      href: '/admin/content',
    },
    {
      title: 'Operations',
      description: 'Manage tournaments and matches.',
      icon: Settings,
      href: '/operations',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
          <Shield className="text-primary" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">System configuration and management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Total Players</p>
          <div className="text-3xl font-black italic">{loading ? '...' : stats.totalPlayers}</div>
        </div>
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Total Tournaments</p>
          <div className="text-3xl font-black italic">{loading ? '...' : stats.totalTournaments}</div>
        </div>
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Pending Claims</p>
          <div className={`text-3xl font-black italic ${stats.pendingClaims > 0 ? 'text-amber-500' : ''}`}>
            {loading ? '...' : stats.pendingClaims}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black uppercase tracking-tight italic">Pending Account Claims</h2>
            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {claims.length} Requests
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {claims.length > 0 ? (
                claims.map((claim) => (
                  <motion.div
                    key={claim.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Users className="text-primary" size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black uppercase tracking-tight italic">{claim.discord_username}</span>
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">is claiming</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link 
                            href={`/players/${claim.player?.username}`}
                            className="text-primary hover:underline font-black uppercase tracking-tight italic text-sm flex items-center gap-1"
                          >
                            {claim.player?.display_name}
                            <ExternalLink size={12} />
                          </Link>
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">(@{claim.player?.username})</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                          <Clock size={10} />
                          {new Date(claim.created_at).toLocaleDateString()} at {new Date(claim.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDenyClaim(claim.id)}
                        className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <X size={14} />
                        Deny
                      </button>
                      <button
                        onClick={() => handleApproveClaim(claim)}
                        className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-primary text-white hover:bg-primary/90 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                      >
                        <Check size={14} />
                        Approve
                      </button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="p-12 rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-center">
                  <Clock className="text-muted-foreground mb-4 opacity-20" size={48} />
                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No pending claims to review</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-tight italic mb-6 text-right">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4">
            {cards.map((card, index) => (
              <Link key={card.href} href={card.href}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/50 transition-all group h-full flex flex-col"
                >
                  <card.icon className="text-primary mb-4 group-hover:scale-110 transition-transform" size={32} />
                  <h2 className="text-lg font-bold uppercase tracking-wider mb-2">{card.title}</h2>
                  <p className="text-sm text-muted-foreground flex-1">{card.description}</p>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
