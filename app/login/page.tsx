'use client';

import { Shield, MessageSquare } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const supabase = getSupabase();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin is from AI Studio preview or localhost
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        checkUser();
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setIsLoading(false);
        if (event.data.error === 'not_member') {
          toast.error('You must be a member of the required Discord server to log in.');
        } else {
          toast.error('Discord login failed.');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [supabase]);

  const checkUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    const user = data?.user;
    if (user) {
      // Check referees table first
      const { data: refData } = await supabase.from('referees').select('role').eq('auth_user_id', user.id).single();
      if (refData && refData.role) {
        const role = refData.role.toLowerCase();
        if (role === 'admin') {
          window.location.href = '/admin';
          return;
        } else if (role === 'ops') {
          window.location.href = '/operations';
          return;
        } else if (role === 'referee') {
          window.location.href = '/referee';
          return;
        }
      }

      const { data: player } = await supabase.from('players').select('id').eq('discord_id', user.id).single();
      if (player) {
        const { data: userRoles } = await supabase.from('user_roles').select('roles(name)').eq('player_id', player.id);
        const roleNames = userRoles?.map((r: any) => r.roles?.name || r.roles?.[0]?.name) || [];
        if (roleNames.includes('Admin')) {
          window.location.href = '/admin';
        } else if (roleNames.includes('Ops')) {
          window.location.href = '/operations';
        } else if (roleNames.includes('Referee')) {
          window.location.href = '/referee';
        } else {
          window.location.href = '/rankings';
        }
      } else {
        // Check for pending claim
        const { data: claim } = await supabase
          .from('account_claims')
          .select('id')
          .eq('auth_user_id', user.id)
          .eq('status', 'pending')
          .single();

        if (!claim) {
          window.location.href = '/claim';
        } else {
          window.location.href = '/claim';
        }
      }
    }
  };

  useEffect(() => {
    checkUser();
  }, [supabase]);

  const handleDiscordLogin = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          scopes: 'identify email guilds',
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      
      if (data?.url) {
        const authWindow = window.open(
          data.url,
          'oauth_popup',
          'width=600,height=700'
        );
        if (!authWindow) {
          toast.error('Please allow popups for this site to connect your account.');
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error logging in with Discord:', error);
      setIsLoading(false);
      toast.error('Discord login failed');
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEmailLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      
      const user = data.user;
      if (user) {
        // Check referees table first
        const { data: refData } = await supabase.from('referees').select('role').eq('auth_user_id', user.id).single();
        if (refData && refData.role) {
          const role = refData.role.toLowerCase();
          if (role === 'admin') {
            window.location.href = '/admin';
            return;
          } else if (role === 'ops') {
            window.location.href = '/operations';
            return;
          } else if (role === 'referee') {
            window.location.href = '/referee';
            return;
          }
        }

        const { data: player } = await supabase.from('players').select('id, status').eq('discord_id', user.id).single();
        if (player) {
          if (player.status === 'pending') {
            window.location.href = '/pending';
            return;
          }
          if (player.status === 'rejected') {
            window.location.href = '/rejected';
            return;
          }
          const { data: userRoles } = await supabase.from('user_roles').select('roles(name)').eq('player_id', player.id);
          const roleNames = userRoles?.map((r: any) => r.roles?.name || r.roles?.[0]?.name) || [];
          if (roleNames.includes('Admin')) {
            window.location.href = '/admin';
          } else if (roleNames.includes('Ops')) {
            window.location.href = '/operations';
          } else if (roleNames.includes('Referee')) {
            window.location.href = '/referee';
          } else {
            window.location.href = '/rankings';
          }
        } else {
          window.location.href = '/rankings';
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
      setIsEmailLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEmailLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      toast.success('Password reset email sent!');
      setShowForgotPassword(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset email');
    } finally {
      setIsEmailLoading(false);
    }
  };

  if (!isMounted) {
    return <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 opacity-0" />;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-card border border-border rounded-[2.5rem] p-10 shadow-2xl text-center"
      >
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/40 mx-auto mb-6">
          <Shield className="text-white" size={32} />
        </div>
        
        <h1 className="text-3xl font-black uppercase tracking-tighter italic mb-2">
          Welcome to <span className="text-primary">Clash</span> Stats
        </h1>
        <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[8px] mb-8">
          The Professional Scorer & Ranking System
        </p>

        <div className="space-y-6">
          <button
            onClick={handleDiscordLogin}
            disabled={isLoading || isEmailLoading}
            className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-[#5865F2]/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageSquare size={18} />
            {isLoading ? 'Connecting...' : 'Login with Discord'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border"></span>
            </div>
            <div className="relative flex justify-center text-[8px] uppercase font-black tracking-widest">
              <span className="bg-card px-4 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          {!showForgotPassword ? (
            <form onSubmit={handleEmailLogin} className="space-y-4 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                  placeholder="name@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || isEmailLoading}
                className="w-full py-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                {isEmailLoading ? 'Signing in...' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="w-full text-[8px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
              >
                Forgot your password?
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                  placeholder="name@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || isEmailLoading}
                className="w-full py-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                {isEmailLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="w-full text-[8px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
              >
                Back to login
              </button>
            </form>
          )}
        </div>

        <p className="mt-8 text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
          By logging in, you agree to our terms of service and privacy policy.
          New accounts require admin approval.
        </p>
      </motion.div>
    </div>
  );
}
