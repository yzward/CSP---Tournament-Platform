'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { Player } from '@/types';
import { Search, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function ClaimPage() {
  const router = useRouter();
  const supabase = getSupabase();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingClaim, setPendingClaim] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) {
        router.push('/');
        return;
      }
      setUser(user);

      // Check if user already has a linked player
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('discord_id', user.id)
        .single();

      if (player) {
        router.push('/rankings');
        return;
      }

      // Check for pending claim
      const { data: claim } = await supabase
        .from('account_claims')
        .select('*, players(*)')
        .eq('auth_user_id', user.id)
        .eq('status', 'pending')
        .single();

      if (claim) {
        setPendingClaim(claim);
      }

      setLoading(false);
    };

    checkUser();
  }, [supabase, router]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .or(`display_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to search players');
    } finally {
      setIsSearching(false);
    }
  };

  const submitClaim = async (player: Player) => {
    if (player.discord_id) {
      toast.error('This profile is already claimed');
      return;
    }

    try {
      const discordUsername = user.user_metadata?.full_name || user.user_metadata?.custom_claims?.global_name || user.email;
      
      const { error } = await supabase
        .from('account_claims')
        .insert({
          auth_user_id: user.id,
          player_id: player.id,
          status: 'pending',
          discord_username: discordUsername
        });

      if (error) throw error;

      toast.success('Claim submitted! An admin will review it soon.');
      setPendingClaim({ players: player });
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit claim');
    }
  };

  const createNewProfile = async () => {
    try {
      const username = user.user_metadata.full_name || user.user_metadata.custom_claims?.global_name || user.email?.split('@')[0] || 'Unknown';
      const displayName = user.user_metadata.full_name || user.user_metadata.custom_claims?.global_name || 'Unknown';
      
      const { error: createError } = await supabase
        .from('players')
        .insert({
          discord_id: user.id,
          username: username,
          display_name: displayName,
          avatar_url: user.user_metadata.avatar_url,
          ranking_points: 0
        });
      
      if (createError) throw createError;

      // Assign default 'Player' role
      const { data: role } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'Player')
        .single();
      
      if (role) {
        const { data: newPlayer } = await supabase
          .from('players')
          .select('id')
          .eq('discord_id', user.id)
          .single();
        
        if (newPlayer) {
          await supabase.from('user_roles').insert({
            player_id: newPlayer.id,
            role_id: role.id
          });
        }
      }

      toast.success('Profile created! Welcome to Clash Stats Pro.');
      router.push('/rankings');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create profile');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="text-primary animate-spin" size={48} />
      </div>
    );
  }

  if (pendingClaim) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 rounded-3xl bg-white/5 border border-white/10"
        >
          <CheckCircle className="text-primary mx-auto mb-6" size={64} />
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-4">Claim Under Review</h1>
          <p className="text-muted-foreground mb-8">
            You have submitted a claim for the profile <span className="text-white font-bold">{pendingClaim.players?.display_name}</span>.
            An admin will review your request shortly.
          </p>
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
            Status: Pending Approval
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black uppercase tracking-tighter italic mb-4">
          Claim Your <span className="text-primary">Profile</span>
        </h1>
        <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">
          Find your existing ranking profile to link it to your Discord account
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative mb-12">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <input
          type="text"
          placeholder="Search by name or username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-16 pr-6 py-5 text-lg font-bold focus:outline-none focus:border-primary transition-all"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="absolute right-4 top-1/2 -translate-y-1/2 px-6 py-2 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {searchResults.map((player) => (
            <motion.div
              key={player.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="p-6 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4 group hover:border-primary/50 transition-all"
            >
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-primary/30 transition-all">
                {player.avatar_url ? (
                  <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center">
                    <User size={24} className="text-primary" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black uppercase tracking-tight italic truncate">{player.display_name}</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">@{player.username}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-white/5 rounded-full">{player.region}</span>
                  {player.club && <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-white/5 rounded-full">{player.club}</span>}
                </div>
              </div>
              <button
                onClick={() => submitClaim(player)}
                disabled={!!player.discord_id}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  player.discord_id 
                    ? 'bg-red-500/10 text-red-500 cursor-not-allowed' 
                    : 'bg-primary text-white hover:bg-primary/90'
                }`}
              >
                {player.discord_id ? 'Claimed' : 'This is me'}
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {searchResults.length === 0 && searchQuery && !isSearching && (
        <div className="text-center py-12">
          <AlertCircle className="text-muted-foreground mx-auto mb-4" size={48} />
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs mb-8">No players found matching "{searchQuery}"</p>
          
          <div className="max-w-md mx-auto p-8 rounded-3xl bg-primary/5 border border-primary/20">
            <h3 className="text-xl font-black uppercase tracking-tight italic mb-2">New to the rankings?</h3>
            <p className="text-sm text-muted-foreground mb-6">If you don't have an existing profile, you can create a new one now.</p>
            <button
              onClick={createNewProfile}
              className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              Create New Profile
            </button>
          </div>
        </div>
      )}

      {!searchQuery && (
        <div className="max-w-md mx-auto p-8 rounded-3xl bg-white/5 border border-white/10 text-center">
          <h3 className="text-xl font-black uppercase tracking-tight italic mb-2">First time here?</h3>
          <p className="text-sm text-muted-foreground mb-6">If you've never competed in a Spirit Gaming tournament before, create a new profile.</p>
          <button
            onClick={createNewProfile}
            className="w-full py-4 bg-white/5 text-white border border-white/10 font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all"
          >
            Create New Profile
          </button>
        </div>
      )}
    </div>
  );
}
