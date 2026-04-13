'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Notification } from '@/types';
import { Bell, Check, ExternalLink, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = getSupabase();
  const router = useRouter();

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data: authData, error } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      const { data: playerData } = await (supabase as any)
        .from('players')
        .select('id')
        .eq('discord_id', user.id)
        .single();

      if (!playerData) return;

      const { data } = await (supabase as any)
        .from('notifications')
        .select('*')
        .eq('player_id', playerData.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setNotifications(data as Notification[]);
        setUnreadCount((data as any[]).filter(n => !n.read).length);
      }
    };

    fetchNotifications();

    // Real-time subscription
    const setupSubscription = async () => {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;

      const { data: playerData } = await (supabase as any)
        .from('players')
        .select('id')
        .eq('discord_id', user.id)
        .single();

      if (!playerData) return;

      const channel = supabase
        .channel(`notifications-${playerData.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'notifications', 
          filter: `player_id=eq.${playerData.id}` 
        }, () => {
          fetchNotifications();
        })
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    };

    setupSubscription();
  }, [supabase]);

  const markAsRead = async (id: string) => {
    const { error } = await (supabase as any)
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) {
      toast.error('Failed to mark as read');
    } else {
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    const { data, error: authError } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;

    const { data: playerData } = await (supabase as any)
      .from('players')
      .select('id')
      .eq('discord_id', user.id)
      .single();

    if (!playerData) return;

    const { error } = await (supabase as any)
      .from('notifications')
      .update({ read: true })
      .eq('player_id', playerData.id)
      .eq('read', false);

    if (error) {
      toast.error('Failed to mark all as read');
    } else {
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) markAsRead(notification.id);
    if (notification.link) {
      router.push(notification.link);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-muted-foreground hover:text-white transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-background">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-border flex items-center justify-between bg-white/5">
                <h3 className="text-xs font-black uppercase tracking-widest italic">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[8px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-4 border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-white/5 relative group ${
                        !n.read ? 'bg-primary/5' : ''
                      }`}
                    >
                      {!n.read && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                      )}
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-bold text-white leading-relaxed">
                          {n.message}
                        </p>
                        <span className="text-[8px] font-medium text-muted-foreground uppercase tracking-widest">
                          {new Date(n.created_at).toLocaleString()}
                        </span>
                      </div>
                      {n.link && (
                        <ExternalLink size={10} className="absolute right-4 top-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic">
                      No notifications yet
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
