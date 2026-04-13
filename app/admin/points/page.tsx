'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Award, ArrowLeft, Save, Plus, Trash2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';

interface PointsScale {
  id?: string;
  placement: number;
  points: number;
}

export default function PointsScaleAdmin() {
  const [scales, setScales] = useState<PointsScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = getSupabase();

  useEffect(() => {
    fetchScale();
  }, [supabase]);

  const fetchScale = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('points_scale')
      .select('*')
      .order('placement', { ascending: true });

    if (error) {
      toast.error('Failed to load points scale');
      console.error(error);
    } else {
      setScales(data || []);
    }
    setLoading(false);
  };

  const handleAdd = () => {
    const nextPlacement = scales.length > 0 ? Math.max(...scales.map(s => s.placement)) + 1 : 1;
    setScales([...scales, { placement: nextPlacement, points: 0 }]);
  };

  const handleRemove = (index: number) => {
    const newScales = [...scales];
    newScales.splice(index, 1);
    setScales(newScales);
  };

  const handleChange = (index: number, field: keyof PointsScale, value: number) => {
    const newScales = [...scales];
    newScales[index] = { ...newScales[index], [field]: value };
    setScales(newScales);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // For simplicity, we delete all and insert the new scale
      const { error: deleteError } = await supabase.from('points_scale').delete().neq('placement', -1); 
      if (deleteError) throw deleteError;

      if (scales.length > 0) {
        const insertData = scales.map(s => ({
          placement: s.placement,
          points: s.points
        }));
        
        const { error: insertError } = await supabase.from('points_scale').insert(insertData);
        if (insertError) throw insertError;
      }

      toast.success('Points scale updated successfully');
      fetchScale();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save points scale');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link 
        href="/admin" 
        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors mb-8"
      >
        <ArrowLeft size={14} />
        Back to Admin
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
            <Award className="text-primary" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Points Scale</h1>
            <p className="text-sm text-muted-foreground">Manage the tournament placement points</p>
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="px-6 py-3 rounded-xl bg-primary text-white hover:bg-primary/90 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="bg-card border border-border rounded-3xl p-8">
        {loading ? (
          <div className="flex justify-center p-8">
            <Award className="text-primary animate-pulse" size={32} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Placement</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Points Awarded</div>
            </div>
            
            <div className="space-y-3">
              {scales.map((scale, index) => (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={index} 
                  className="flex items-center gap-4"
                >
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      value={scale.placement}
                      onChange={(e) => handleChange(index, 'placement', parseInt(e.target.value) || 0)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 pl-12 text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black italic">#</span>
                  </div>
                  
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      value={scale.points}
                      onChange={(e) => handleChange(index, 'points', parseInt(e.target.value) || 0)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 pl-12 text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-black italic">+</span>
                  </div>

                  <button
                    onClick={() => handleRemove(index)}
                    className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </motion.div>
              ))}
            </div>

            <button
              onClick={handleAdd}
              className="w-full py-4 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest mt-6"
            >
              <Plus size={14} />
              Add Placement Tier
            </button>
            
            <div className="flex items-start gap-3 p-4 mt-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                Changes to the points scale will only affect newly completed tournaments. To apply these changes to past tournaments, you must recalculate them.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}