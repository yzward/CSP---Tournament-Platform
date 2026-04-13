'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { TournamentFormat, StageType } from '@/types';
import { Trophy, Calendar, Layout, Award, ChevronLeft, Shield, Zap, MapPin, AlignLeft, Link2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

import { notifyRefs } from '@/lib/notifications';

export default function CreateTournament() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    stage_type: 'single' as StageType,
    stage1_format: 'swiss' as TournamentFormat,
    stage2_format: null as TournamentFormat | null,
    stage1_fixed_decks: false,
    stage2_fixed_decks: false,
    held_at: new Date().toISOString().split('T')[0],
    is_ranking_tournament: true,
    fixed_decks: false,
    top_cut_size: 8,
    location: '',
    description: '',
    discord_webhook_url: '',
  });

  const supabase = getSupabase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { stage1_fixed_decks, stage2_fixed_decks, location, description, discord_webhook_url, held_at, top_cut_size, ...coreData } = formData;

    // Only include optional columns if they have a value (avoids PGRST204 if migrations haven't been run yet)
    const optionalFields: Record<string, any> = {};
    if (location) optionalFields.location = location;
    if (description) optionalFields.description = description;
    if (discord_webhook_url) optionalFields.discord_webhook_url = discord_webhook_url;
    if (formData.stage_type === 'two_stage') optionalFields.top_cut_size = top_cut_size;

    const { data: newTournament, error } = await (supabase as any)
      .from('tournaments')
      .insert({ ...coreData, held_at, format: formData.stage1_format, ...optionalFields, status: 'active' })
      .select()
      .single();

    if (error) {
      toast.error(`Failed to create tournament: ${error.message || error.details || JSON.stringify(error)}`);
      console.error(error);
    } else {
      toast.success('Tournament created successfully!');
      
      await notifyRefs(
        'tournament_starting',
        `Tournament ${formData.name} is starting! Check assignments.`,
        `/operations`
      );

      router.push('/operations');
    }
    setLoading(false);
  };

  const stage1Formats: TournamentFormat[] = formData.stage_type === 'single' 
    ? ['single_elim', 'double_elim', 'round_robin', 'swiss']
    : ['round_robin', 'swiss'];

  const stage2Formats: TournamentFormat[] = ['single_elim', 'double_elim'];

  const formatLabels: Record<string, string> = {
    single_elim: 'Single Elimination',
    double_elim: 'Double Elimination',
    round_robin: 'Round Robin',
    swiss: 'Swiss'
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 pb-32">
      <Link
        href="/operations"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group"
      >
        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-widest">Back to Dashboard</span>
      </Link>

      <div className="mb-12">
        <h1 className="text-6xl font-bold italic uppercase tracking-tighter mb-4">
          Create <span className="text-primary">Tournament</span>
        </h1>
        <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">
          Configure your competitive event structure
        </p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-12"
      >
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Trophy size={14} /> Tournament Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Clash Masters 2026"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-dark w-full h-14"
            />
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Calendar size={14} /> Event Date
            </label>
            <input
              type="date"
              required
              value={formData.held_at}
              onChange={(e) => setFormData({ ...formData, held_at: e.target.value })}
              className="input-dark w-full h-14"
            />
          </div>
        </div>

        {/* Location & Description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <MapPin size={14} /> Venue / Location
            </label>
            <input
              type="text"
              placeholder="e.g. Auckland CBD, NZ"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="input-dark w-full h-14"
            />
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Link2 size={14} /> Discord Webhook URL <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <input
              type="url"
              placeholder="https://discord.com/api/webhooks/..."
              value={formData.discord_webhook_url}
              onChange={(e) => setFormData({ ...formData, discord_webhook_url: e.target.value })}
              className="input-dark w-full h-14"
            />
          </div>
        </div>
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <AlignLeft size={14} /> Event Description <span className="text-muted-foreground/50">(shown publicly)</span>
          </label>
          <textarea
            placeholder="Describe the event, rules, entry requirements..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="input-dark w-full resize-none py-4"
          />
        </div>

        {/* Stage Selection */}
        <div className="space-y-6">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Layout size={14} /> Stage Structure
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              type="button"
              onClick={() => setFormData({ 
                ...formData, 
                stage_type: 'single', 
                stage2_format: null,
                stage1_format: 'swiss',
                stage2_fixed_decks: false
              })}
              className={`p-8 rounded-3xl border-2 text-left transition-all duration-300 group ${
                formData.stage_type === 'single' 
                  ? 'bg-primary/10 border-primary shadow-[0_0_30px_rgba(124,58,237,0.2)]' 
                  : 'bg-card border-white/5 hover:border-white/10'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Layout className={formData.stage_type === 'single' ? 'text-primary' : 'text-muted-foreground'} size={24} />
              </div>
              <h3 className="text-xl font-bold italic uppercase mb-2">Single Stage</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A straightforward tournament with one format from start to finish.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFormData({ 
                ...formData, 
                stage_type: 'two_stage', 
                stage1_format: 'swiss',
                stage2_format: 'single_elim'
              })}
              className={`p-8 rounded-3xl border-2 text-left transition-all duration-300 group ${
                formData.stage_type === 'two_stage' 
                  ? 'bg-primary/10 border-primary shadow-[0_0_30px_rgba(124,58,237,0.2)]' 
                  : 'bg-card border-white/5 hover:border-white/10'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className={formData.stage_type === 'two_stage' ? 'text-primary' : 'text-muted-foreground'} size={24} />
              </div>
              <h3 className="text-xl font-bold italic uppercase mb-2">Two Stage</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Group stage (Swiss/RR) feeding into a finals bracket (Elimination).
              </p>
            </button>
          </div>
        </div>

        {/* Top Cut Size — only for two-stage */}
        {formData.stage_type === 'two_stage' && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Shield size={14} /> Top Cut Size
              <span className="text-muted-foreground/50 normal-case tracking-normal font-normal">— how many players advance to Stage 2</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {[4, 8, 16, 32].map(n => (
                <button key={n} type="button"
                  onClick={() => setFormData({ ...formData, top_cut_size: n })}
                  className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                    formData.top_cut_size === n ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  }`}>
                  Top {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Format Selection */}
        <div className="bg-card/50 border border-white/5 rounded-[2.5rem] p-8 md:p-12 space-y-10">
          {formData.stage_type === 'two_stage' && (
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-primary">Stage 1</div>
              <div className="h-px flex-1 bg-white/5" />
              <ChevronLeft className="rotate-180 text-muted-foreground" size={16} />
              <div className="h-px flex-1 bg-white/5" />
              <div className="text-[10px] font-black uppercase tracking-widest text-primary">Stage 2</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Stage 1 Format */}
            <div className="space-y-6">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                {formData.stage_type === 'two_stage' ? 'Stage 1 (Group Stage)' : 'Tournament Format'}
              </label>
              <div className="flex flex-wrap gap-3">
                {stage1Formats.map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setFormData({ ...formData, stage1_format: format })}
                    className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                      formData.stage1_format === format 
                        ? 'bg-primary text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]' 
                        : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                    }`}
                  >
                    {formatLabels[format]}
                  </button>
                ))}
              </div>
            </div>

            {/* Stage 2 Format */}
            {formData.stage_type === 'two_stage' && (
              <div className="space-y-6">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                  Stage 2 (Finals Bracket)
                </label>
                <div className="flex flex-wrap gap-3">
                  {stage2Formats.map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => setFormData({ ...formData, stage2_format: format })}
                      className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                        formData.stage2_format === format 
                          ? 'bg-primary text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]' 
                          : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                    }`}
                    >
                      {formatLabels[format]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="pt-6 border-t border-white/5">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              Note: Byes handled automatically for uneven player counts. Swiss and Round Robin support any number of players including 100+
            </p>
          </div>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {formData.stage_type === 'single' ? (
            <div className="bg-card border border-white/5 rounded-3xl p-8 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-widest mb-1">Fixed Decks</h4>
                  <p className="text-[10px] text-muted-foreground">Players cannot change decks during tournament</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, stage1_fixed_decks: !formData.stage1_fixed_decks, fixed_decks: !formData.stage1_fixed_decks })}
                  className={`w-14 h-8 rounded-full transition-colors relative ${formData.stage1_fixed_decks ? 'bg-primary' : 'bg-white/10'}`}
                >
                  <motion.div 
                    animate={{ x: formData.stage1_fixed_decks ? 24 : 4 }}
                    className="absolute top-1 left-0 w-6 h-6 bg-white rounded-full shadow-lg"
                  />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-card border border-white/5 rounded-3xl p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-widest mb-1">Fixed Decks (Stage 1)</h4>
                    <p className="text-[10px] text-muted-foreground">Fixed decks for Group Stage</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, stage1_fixed_decks: !formData.stage1_fixed_decks })}
                    className={`w-14 h-8 rounded-full transition-colors relative ${formData.stage1_fixed_decks ? 'bg-primary' : 'bg-white/10'}`}
                  >
                    <motion.div 
                      animate={{ x: formData.stage1_fixed_decks ? 24 : 4 }}
                      className="absolute top-1 left-0 w-6 h-6 bg-white rounded-full shadow-lg"
                    />
                  </button>
                </div>
              </div>
              <div className="bg-card border border-white/5 rounded-3xl p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-widest mb-1">Fixed Decks (Stage 2)</h4>
                    <p className="text-[10px] text-muted-foreground">Fixed decks for Top Cut</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, stage2_fixed_decks: !formData.stage2_fixed_decks })}
                    className={`w-14 h-8 rounded-full transition-colors relative ${formData.stage2_fixed_decks ? 'bg-primary' : 'bg-white/10'}`}
                  >
                    <motion.div 
                      animate={{ x: formData.stage2_fixed_decks ? 24 : 4 }}
                      className="absolute top-1 left-0 w-6 h-6 bg-white rounded-full shadow-lg"
                    />
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="bg-card border border-white/5 rounded-3xl p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-widest mb-1">Ranking Tournament</h4>
                <p className="text-[10px] text-muted-foreground">Award points to players based on placement</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_ranking_tournament: !formData.is_ranking_tournament })}
                className={`w-14 h-8 rounded-full transition-colors relative ${formData.is_ranking_tournament ? 'bg-primary' : 'bg-white/10'}`}
              >
                <motion.div 
                  animate={{ x: formData.is_ranking_tournament ? 24 : 4 }}
                  className="absolute top-1 left-0 w-6 h-6 bg-white rounded-full shadow-lg"
                />
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-purple w-full py-6 text-sm uppercase tracking-[0.3em]"
        >
          {loading ? 'Creating...' : 'Create Tournament'}
        </button>
      </motion.form>
    </div>
  );
}
