'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Trophy, Calendar, MapPin, AlignLeft, Link2, ChevronLeft, Layout, Zap, Award, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

export default function EditTournament({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = getSupabase();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    held_at: '',
    stage1_format: 'swiss',
    stage2_format: null as string | null,
    stage_type: 'single',
    is_ranking_tournament: true,
    fixed_decks: false,
    top_cut_size: 8,
    location: '',
    description: '',
    discord_webhook_url: '',
  });

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await (supabase as any)
        .from('tournaments').select('*').eq('id', id).single();
      if (error || !data) { toast.error('Tournament not found'); router.push('/operations'); return; }
      setFormData({
        name: data.name || '',
        held_at: data.held_at ? data.held_at.split('T')[0] : '',
        stage1_format: data.stage1_format || 'swiss',
        stage2_format: data.stage2_format || null,
        stage_type: data.stage_type || 'single',
        is_ranking_tournament: data.is_ranking_tournament ?? true,
        fixed_decks: data.fixed_decks ?? false,
        top_cut_size: data.top_cut_size || 8,
        location: data.location || '',
        description: data.description || '',
        discord_webhook_url: data.discord_webhook_url || '',
      });
      setLoading(false);
    };
    fetch();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const updateData: any = {
      name: formData.name,
      held_at: formData.held_at,
      stage1_format: formData.stage1_format,
      stage2_format: formData.stage2_format,
      stage_type: formData.stage_type,
      is_ranking_tournament: formData.is_ranking_tournament,
      fixed_decks: formData.fixed_decks,
      format: formData.stage1_format,
      top_cut_size: formData.stage_type === 'two_stage' ? formData.top_cut_size : null,
    };
    if (formData.location)             updateData.location = formData.location;
    if (formData.description)          updateData.description = formData.description;
    if (formData.discord_webhook_url)  updateData.discord_webhook_url = formData.discord_webhook_url;

    const { error } = await (supabase as any)
      .from('tournaments').update(updateData).eq('id', id);

    if (error) {
      toast.error(`Failed to save: ${error.message}`);
    } else {
      toast.success('Tournament updated');
      router.push('/operations');
    }
    setSaving(false);
  };

  const formatLabels: Record<string, string> = {
    single_elim: 'Single Elim', double_elim: 'Double Elim',
    round_robin: 'Round Robin', swiss: 'Swiss',
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Trophy className="text-primary animate-pulse" size={48} />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 pb-32">
      <Link href="/operations" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group">
        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-widest">Back to Dashboard</span>
      </Link>

      <div className="mb-12">
        <h1 className="text-5xl font-bold italic uppercase tracking-tighter mb-4">
          Edit <span className="text-primary">Tournament</span>
        </h1>
        <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">
          Update event details
        </p>
      </div>

      <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="space-y-10">

        {/* Name + Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Trophy size={14} /> Tournament Name
            </label>
            <input type="text" required value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="input-dark w-full h-14" />
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Calendar size={14} /> Event Date
            </label>
            <input type="date" required value={formData.held_at}
              onChange={e => setFormData({ ...formData, held_at: e.target.value })}
              className="input-dark w-full h-14" />
          </div>
        </div>

        {/* Location + Webhook */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <MapPin size={14} /> Venue / Location
            </label>
            <input type="text" placeholder="e.g. Auckland CBD, NZ" value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              className="input-dark w-full h-14" />
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Link2 size={14} /> Discord Webhook URL
            </label>
            <input type="url" placeholder="https://discord.com/api/webhooks/..." value={formData.discord_webhook_url}
              onChange={e => setFormData({ ...formData, discord_webhook_url: e.target.value })}
              className="input-dark w-full h-14" />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <AlignLeft size={14} /> Event Description
          </label>
          <textarea value={formData.description} rows={3}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            className="input-dark w-full resize-none py-4" />
        </div>

        {/* Stage Type */}
        <div className="space-y-6">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Layout size={14} /> Stage Structure
          </label>
          <div className="grid grid-cols-2 gap-4">
            {(['single', 'two_stage'] as const).map(type => (
              <button key={type} type="button"
                onClick={() => setFormData({ ...formData, stage_type: type, stage2_format: type === 'two_stage' ? 'single_elim' : null })}
                className={`p-6 rounded-2xl border-2 text-left transition-all ${formData.stage_type === type ? 'bg-primary/10 border-primary' : 'bg-card border-white/5 hover:border-white/10'}`}>
                <div className="font-bold italic uppercase text-sm mb-1">{type === 'single' ? 'Single Stage' : 'Two Stage'}</div>
                <div className="text-[10px] text-muted-foreground">{type === 'single' ? 'One format start to finish' : 'Group stage + top cut'}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Top Cut Size — two-stage only */}
        {formData.stage_type === 'two_stage' && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Shield size={14} /> Top Cut Size
              <span className="text-muted-foreground/50 normal-case tracking-normal font-normal">— players advancing to Stage 2</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {[4, 8, 16, 32].map(n => (
                <button key={n} type="button"
                  onClick={() => setFormData({ ...formData, top_cut_size: n })}
                  className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                    formData.top_cut_size === n ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  }`}>
                  Top {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Formats */}
        <div className="bg-card/50 border border-white/5 rounded-3xl p-8 space-y-8">
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
              {formData.stage_type === 'two_stage' ? 'Stage 1 Format' : 'Tournament Format'}
            </label>
            <div className="flex flex-wrap gap-3">
              {(formData.stage_type === 'single' ? ['single_elim','double_elim','round_robin','swiss'] : ['round_robin','swiss']).map(f => (
                <button key={f} type="button"
                  onClick={() => setFormData({ ...formData, stage1_format: f })}
                  className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${formData.stage1_format === f ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'}`}>
                  {formatLabels[f]}
                </button>
              ))}
            </div>
          </div>
          {formData.stage_type === 'two_stage' && (
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Stage 2 Format (Finals)</label>
              <div className="flex flex-wrap gap-3">
                {['single_elim','double_elim'].map(f => (
                  <button key={f} type="button"
                    onClick={() => setFormData({ ...formData, stage2_format: f })}
                    className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${formData.stage2_format === f ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'}`}>
                    {formatLabels[f]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { key: 'is_ranking_tournament', label: 'Ranking Tournament', desc: 'Award points based on placement', icon: Award },
            { key: 'fixed_decks', label: 'Fixed Decks', desc: 'Players cannot change decks', icon: Zap },
          ].map(({ key, label, desc, icon: Icon }) => (
            <div key={key} className="bg-card border border-white/5 rounded-2xl p-6 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1"><Icon size={14} className="text-primary" /><h4 className="text-xs font-bold uppercase tracking-widest">{label}</h4></div>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </div>
              <button type="button"
                onClick={() => setFormData({ ...formData, [key]: !(formData as any)[key] })}
                className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${(formData as any)[key] ? 'bg-primary' : 'bg-white/10'}`}>
                <motion.div animate={{ x: (formData as any)[key] ? 20 : 2 }}
                  className="absolute top-0.5 left-0 w-6 h-6 bg-white rounded-full shadow" />
              </button>
            </div>
          ))}
        </div>

        <button type="submit" disabled={saving}
          className="btn-purple w-full py-5 text-sm uppercase tracking-[0.3em] disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </motion.form>
    </div>
  );
}
