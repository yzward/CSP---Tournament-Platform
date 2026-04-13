'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Shield, Trophy, Users, LayoutDashboard, LogOut, Menu, X, User, 
  Zap, Settings, Layout, ShieldAlert, UserCog, Award, Bell, Home, Search,
  Clock
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Player, Permissions } from '@/types';
import { motion, AnimatePresence } from 'motion/react';

import NotificationBell from './NotificationBell';

export default function Navbar() {
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [player, setPlayer] = useState<Player | null>(null);
  const [userMetadata, setUserMetadata] = useState<any>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [hasPendingClaim, setHasPendingClaim] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const supabase = getSupabase();

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (user) {
        setUserMetadata(user.user_metadata);
        
        // Check if user has a linked player
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('*')
          .eq('discord_id', user.id)
          .single();

        if (playerData) {
          setPlayer(playerData);
          setIsClaimed(true);
        } else {
          // Check for pending claim
          const { data: claim } = await supabase
            .from('account_claims')
            .select('id')
            .eq('auth_user_id', user.id)
            .eq('status', 'pending')
            .single();
          
          if (claim) {
            setHasPendingClaim(true);
          } else if (pathname !== '/claim' && pathname !== '/') {
            // No claim and not linked - redirect to claim page
            window.location.href = '/claim';
          }
        }

        // Determine roles
        let currentRoles: string[] = [];
        
        if (playerData) {
          try {
            const { data: rolesData } = await (supabase as any)
              .from('user_roles')
              .select('roles!inner(name, permissions)')
              .eq('player_id', (playerData as any).id);

            if (rolesData && rolesData.length > 0) {
              const roleNames = (rolesData as any[]).map(r => r.roles?.name || r.roles?.[0]?.name);
              currentRoles = roleNames;

              const mergedPermissions = (rolesData as any[]).reduce((acc, curr) => {
                const p = curr.roles?.permissions || curr.roles?.[0]?.permissions;
                if (!p) return acc;
                return {
                  can_view_rankings: acc.can_view_rankings || p.can_view_rankings,
                  can_view_profiles: acc.can_view_profiles || p.can_view_profiles,
                  can_edit_own_profile: acc.can_edit_own_profile || p.can_edit_own_profile,
                  can_grab_matches: acc.can_grab_matches || p.can_grab_matches,
                  can_score_matches: acc.can_score_matches || p.can_score_matches,
                  can_submit_matches: acc.can_submit_matches || p.can_submit_matches,
                  can_create_tournaments: acc.can_create_tournaments || p.can_create_tournaments,
                  can_complete_tournaments: acc.can_complete_tournaments || p.can_complete_tournaments,
                  can_manage_refs: acc.can_manage_refs || p.can_manage_refs,
                  can_manage_players: acc.can_manage_players || p.can_manage_players,
                  can_manage_roles: acc.can_manage_roles || p.can_manage_roles,
                  can_access_admin_panel: acc.can_access_admin_panel || p.can_access_admin_panel,
                  can_view_bracket: acc.can_view_bracket || p.can_view_bracket,
                  can_view_meta: acc.can_view_meta || p.can_view_meta,
                  can_manage_own_parts: acc.can_manage_own_parts || p.can_manage_own_parts,
                  can_manage_own_decks: acc.can_manage_own_decks || p.can_manage_own_decks,
                  can_register_for_tournaments: acc.can_register_for_tournaments || p.can_register_for_tournaments,
                  can_declare_deck: acc.can_declare_deck || p.can_declare_deck,
                  can_manage_courts: acc.can_manage_courts || p.can_manage_courts,
                  can_approve_registrations: acc.can_approve_registrations || p.can_approve_registrations,
                  can_approve_decks: acc.can_approve_decks || p.can_approve_decks,
                  can_edit_points_scale: acc.can_edit_points_scale || p.can_edit_points_scale,
                };
              }, {
                can_view_rankings: false,
                can_view_profiles: false,
                can_edit_own_profile: false,
                can_grab_matches: false,
                can_score_matches: false,
                can_submit_matches: false,
                can_create_tournaments: false,
                can_complete_tournaments: false,
                can_manage_refs: false,
                can_manage_players: false,
                can_manage_roles: false,
                can_access_admin_panel: false,
                can_view_bracket: false,
                can_view_meta: false,
                can_manage_own_parts: false,
                can_manage_own_decks: false,
                can_register_for_tournaments: false,
                can_declare_deck: false,
                can_manage_courts: false,
                can_approve_registrations: false,
                can_approve_decks: false,
                can_edit_points_scale: false,
              });
              setPermissions(mergedPermissions);
            }
          } catch (e) {
            console.error("Error fetching from user_roles table:", e);
          }
        }
        setUserRoles(currentRoles);
      }
    };

    fetchUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const isAdmin = permissions?.can_access_admin_panel || userRoles.includes('Admin');
  const isOps = permissions?.can_create_tournaments || userRoles.includes('Ops') || isAdmin;
  const isRef = permissions?.can_score_matches || userRoles.includes('Referee') || userRoles.includes('Temp Referee') || isAdmin;

  const navLinks = [
    { name: 'Rankings', href: '/rankings', icon: Trophy, show: true },
    { name: 'Tournaments', href: '/tournaments', icon: Layout, show: true },
    { name: 'Meta', href: '/meta', icon: Search, show: true },
    { name: 'Ref Dashboard', href: '/referee', icon: Zap, show: isRef },
    { name: 'Operations', href: '/operations', icon: Settings, show: isOps },
    { name: 'Admin Panel', href: '/admin', icon: ShieldAlert, show: isAdmin },
    { name: 'Players', href: '/admin/players', icon: Users, show: isAdmin },
    { name: 'Roles', href: '/admin/roles', icon: UserCog, show: isAdmin },
    { name: 'Points', href: '/admin/points', icon: Award, show: isAdmin },
  ];

  const visibleLinks = navLinks.filter(link => link.show);
  
  // Desktop: Core navigation in the top bar, Admin sub-pages in the profile dropdown
  const desktopMainLinks = visibleLinks.filter(link => !link.href.startsWith('/admin/'));
  const desktopExtraLinks = visibleLinks.filter(link => link.href.startsWith('/admin/'));

  // Mobile: Show first 4 links in bottom bar, others in "More"
  const mobileMainLinks = visibleLinks.slice(0, 4);
  const mobileMoreLinks = visibleLinks.slice(4);

  if (!player && !userMetadata) return null;

  const displayName = player?.display_name || userMetadata?.full_name || userMetadata?.custom_claims?.global_name || 'User';
  const username = player?.username || userMetadata?.email?.split('@')[0] || 'user';
  const avatarUrl = player?.avatar_url || userMetadata?.avatar_url;

  return (
    <>
      {hasPendingClaim && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-black py-2 px-4 text-center text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2">
          <Clock size={14} />
          Your account claim is under review by an admin
        </div>
      )}
      {/* Desktop Top Navbar */}
      <nav className={`hidden md:block fixed left-0 right-0 z-50 bg-[#0f0f1a]/80 backdrop-blur-md border-b border-white/5 transition-all ${hasPendingClaim ? 'top-8' : 'top-0'}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
              <Shield className="text-white" size={18} />
            </div>
            <span className="text-xl font-bold italic uppercase tracking-tighter">
              Clash <span className="text-primary">Stats</span> Pro
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {desktopMainLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 relative group/nav ${
                  pathname === link.href
                    ? 'text-primary bg-primary/10 shadow-[0_0_15px_rgba(139,92,246,0.1)]'
                    : 'text-muted-foreground hover:text-white hover:bg-white/5'
                }`}
              >
                {link.name}
                {pathname === link.href && (
                  <motion.div 
                    layoutId="nav-glow"
                    className="absolute inset-0 border border-primary/30 rounded-lg pointer-events-none"
                  />
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
            
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-3 p-1 rounded-full hover:bg-white/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                      <User size={14} className="text-primary" />
                    </div>
                  )}
                </div>
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 bg-[#0f0f1a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-white/5">
                        <p className="text-xs font-bold text-white truncate">{displayName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">@{username}</p>
                      </div>
                      <div className="p-2">
                        <Link
                          href={`/players/${username}`}
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <User size={14} /> My Profile
                        </Link>
                        
                        {desktopExtraLinks.length > 0 && (
                          <div className="py-1 border-y border-white/5 my-1">
                            {desktopExtraLinks.map((link) => (
                              <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsProfileOpen(false)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                              >
                                <link.icon size={14} /> {link.name}
                              </Link>
                            ))}
                          </div>
                        )}

                        <Link
                          href={`/players/${username}?tab=settings`}
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <Settings size={14} /> Settings
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          <LogOut size={14} /> Logout
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f0f1a]/90 backdrop-blur-lg border-t border-white/5 pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
          {mobileMainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all ${
                pathname === link.href ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <link.icon size={20} />
              <span className="text-[8px] font-bold uppercase tracking-widest">{link.name}</span>
            </Link>
          ))}
          
          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all ${
              isMoreOpen ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Menu size={20} />
            <span className="text-[8px] font-bold uppercase tracking-widest">More</span>
          </button>
        </div>

        {/* Mobile More Menu */}
        <AnimatePresence>
          {isMoreOpen && (
            <>
              <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsMoreOpen(false)} />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="fixed bottom-16 left-0 right-0 bg-[#0f0f1a] border-t border-white/10 rounded-t-3xl z-50 p-6 space-y-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">More Options</h3>
                  <button onClick={() => setIsMoreOpen(false)} className="p-2 text-muted-foreground">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  {mobileMoreLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsMoreOpen(false)}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <link.icon size={20} className="text-primary" />
                      <span className="text-[8px] font-bold uppercase tracking-widest text-center">{link.name}</span>
                    </Link>
                  ))}
                  <Link
                    href={`/players/${username}`}
                    onClick={() => setIsMoreOpen(false)}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <User size={20} className="text-primary" />
                    <span className="text-[8px] font-bold uppercase tracking-widest text-center">Profile</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 transition-colors"
                  >
                    <LogOut size={20} className="text-red-500" />
                    <span className="text-[8px] font-bold uppercase tracking-widest text-center text-red-500">Logout</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
}
