'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Shield, Save, RefreshCw, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

export default function ContentManagementPage() {
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const supabase = getSupabase();

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('site_content').select('*').order('id');
      
      if (error) {
        console.error('Supabase error:', error);
        // If the table doesn't exist, we'll get an error. 
        // In this environment, we should inform the user if it's a schema issue.
        if (error.code === '42P01' || error.message.includes('Could not find the table')) {
          toast.error('Database table "site_content" does not exist. Please run the migration in Supabase SQL Editor.');
        } else {
          toast.error(`Failed to fetch content: ${error.message}`);
        }
        return;
      }

      setContent(data || []);
      
      // Ensure common keys exist
      const commonKeys = [
        { id: 'rankings.podium.champion_label', content: 'World Champion' }
      ];
      
      let needsRefresh = false;
      for (const key of commonKeys) {
        if (!data?.find(item => item.id === key.id)) {
          const { error: insertError } = await supabase.from('site_content').insert(key);
          if (!insertError) needsRefresh = true;
        }
      }

      if (needsRefresh) {
        const { data: newData } = await supabase.from('site_content').select('*').order('id');
        if (newData) setContent(newData);
      }
    } catch (err: any) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred while fetching content');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, newContent: string) => {
    setSaving(id);
    const { error } = await supabase
      .from('site_content')
      .update({ content: newContent, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error(`Failed to update ${id}`);
    } else {
      toast.success(`Updated ${id}`);
    }
    setSaving(null);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><RefreshCw className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-center gap-4 mb-12">
        <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
          <Edit3 className="text-primary" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Content Management</h1>
          <p className="text-sm text-muted-foreground">Edit site text and headlines</p>
        </div>
      </div>

      <div className="space-y-8">
        {content.map((item) => (
          <div key={item.id} className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">{item.id}</span>
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                Last updated: {new Date(item.updated_at).toLocaleString()}
              </span>
            </div>
            
            <textarea
              className="w-full bg-background border border-border rounded-xl p-4 text-sm font-medium focus:outline-none focus:border-primary transition-colors min-h-[100px]"
              defaultValue={item.content}
              onBlur={(e) => {
                if (e.target.value !== item.content) {
                  handleUpdate(item.id, e.target.value);
                }
              }}
            />
            
            <div className="flex justify-end">
              <button
                disabled={saving === item.id}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-50 transition-all"
              >
                {saving === item.id ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                {saving === item.id ? 'Saving...' : 'Auto-saves on blur'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
