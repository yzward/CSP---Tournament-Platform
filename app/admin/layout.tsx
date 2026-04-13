'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const router = useRouter();
  const supabase = getSupabase();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data, error: authError } = await supabase.auth.getUser();
      const user = data?.user;
      
      if (!user) {
        router.push('/rankings');
        return;
      }

      // Check if user is admin via user_roles joined with roles
      const { data: rolesData, error } = await supabase
        .from('user_roles')
        .select(`
          roles!inner (
            name
          )
        `)
        .eq('player_id', (await supabase.from('players').select('id').eq('discord_id', user.id).single()).data?.id)
        .eq('roles.name', 'Admin');

      if (error || !rolesData || rolesData.length === 0) {
        router.push('/rankings');
      } else {
        setIsAdmin(true);
      }
    };

    checkAdmin();
  }, [supabase, router]);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a]">
        <Loader2 className="text-primary animate-spin" size={48} />
      </div>
    );
  }

  return <>{children}</>;
}
