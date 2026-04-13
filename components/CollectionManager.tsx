'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Part, Beyblade, Deck } from '@/types';
import { Plus, Trash2, Shield, Zap, Layers, AlertCircle, Save, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface CollectionManagerProps {
  playerId: string;
  readOnly?: boolean;
}

export default function CollectionManager({ playerId, readOnly = false }: CollectionManagerProps) {
  const [parts, setParts] = useState<Part[]>([]);
  const [beyblades, setBeyblades] = useState<Beyblade[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newPartName, setNewPartName] = useState('');
  const [newPartType, setNewPartType] = useState<'blade' | 'ratchet' | 'bit'>('blade');
  
  const [newBeyName, setNewBeyName] = useState('');
  const [selectedBlade, setSelectedBlade] = useState('');
  const [selectedRatchet, setSelectedRatchet] = useState('');
  const [selectedBit, setSelectedBit] = useState('');

  const [newDeckName, setNewDeckName] = useState('');
  const [selectedBeys, setSelectedBeys] = useState<string[]>(['', '', '']);

  const supabase = getSupabase();

  useEffect(() => {
    fetchData();
  }, [playerId, supabase]);

  const fetchData = async () => {
    setLoading(true);
    const [partsRes, beysRes, decksRes] = await Promise.all([
      (supabase as any).from('parts').select('*').eq('player_id', playerId),
      (supabase as any).from('beyblades').select('*, blade:blade_id(*), ratchet:ratchet_id(*), bit:bit_id(*)').eq('player_id', playerId),
      (supabase as any).from('decks').select('*, bey1:bey1_id(*), bey2:bey2_id(*), bey3:bey3_id(*)').eq('player_id', playerId)
    ]);

    if (partsRes.data) setParts(partsRes.data);
    if (beysRes.data) setBeyblades(beysRes.data);
    if (decksRes.data) setDecks(decksRes.data);
    setLoading(false);
  };

  const addPart = async () => {
    if (readOnly || !newPartName) return;
    const { error } = await (supabase as any).from('parts').insert({
      player_id: playerId,
      name: newPartName,
      type: newPartType
    });

    if (error) toast.error('Failed to add part');
    else {
      toast.success('Part added');
      setNewPartName('');
      fetchData();
    }
  };

  const deletePart = async (id: string) => {
    if (readOnly) return;
    const { error } = await (supabase as any).from('parts').delete().eq('id', id);
    if (error) toast.error('Failed to delete part (it might be in use)');
    else {
      toast.success('Part deleted');
      fetchData();
    }
  };

  const createBeyblade = async () => {
    if (readOnly || !newBeyName || !selectedBlade || !selectedRatchet || !selectedBit) {
      toast.error('Please fill all fields');
      return;
    }

    const { error } = await (supabase as any).from('beyblades').insert({
      player_id: playerId,
      name: newBeyName,
      blade_id: selectedBlade,
      ratchet_id: selectedRatchet,
      bit_id: selectedBit
    });

    if (error) toast.error('Failed to create Beyblade');
    else {
      toast.success('Beyblade created');
      setNewBeyName('');
      setSelectedBlade('');
      setSelectedRatchet('');
      setSelectedBit('');
      fetchData();
    }
  };

  const deleteBeyblade = async (id: string) => {
    if (readOnly) return;
    const { error } = await (supabase as any).from('beyblades').delete().eq('id', id);
    if (error) toast.error('Failed to delete Beyblade');
    else {
      toast.success('Beyblade deleted');
      fetchData();
    }
  };

  const validateDeck = (beyIds: string[]) => {
    const selectedBeysData = beyblades.filter(b => beyIds.includes(b.id));
    if (selectedBeysData.length < 3) return { valid: false, error: 'Select 3 Beyblades' };

    const partsUsed = new Set<string>();
    const duplicates = new Set<string>();

    selectedBeysData.forEach(bey => {
      [bey.blade_id, bey.ratchet_id, bey.bit_id].forEach(partId => {
        if (partsUsed.has(partId)) {
          const part = parts.find(p => p.id === partId);
          if (part) duplicates.add(part.name);
        }
        partsUsed.add(partId);
      });
    });

    if (duplicates.size > 0) {
      return { 
        valid: false, 
        error: `Duplicate part detected — ${Array.from(duplicates).join(', ')} appears in more than one beyblade in this deck` 
      };
    }

    return { valid: true };
  };

  const createDeck = async () => {
    if (readOnly || !newDeckName || selectedBeys.some(id => !id)) {
      toast.error('Please fill all fields');
      return;
    }

    const validation = validateDeck(selectedBeys);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const { error } = await (supabase as any).from('decks').insert({
      player_id: playerId,
      name: newDeckName,
      bey1_id: selectedBeys[0],
      bey2_id: selectedBeys[1],
      bey3_id: selectedBeys[2]
    });

    if (error) toast.error('Failed to create Deck');
    else {
      toast.success('Deck created');
      setNewDeckName('');
      setSelectedBeys(['', '', '']);
      fetchData();
    }
  };

  const deleteDeck = async (id: string) => {
    if (readOnly) return;
    const { error } = await (supabase as any).from('decks').delete().eq('id', id);
    if (error) toast.error('Failed to delete Deck');
    else {
      toast.success('Deck deleted');
      fetchData();
    }
  };

  if (loading) return <div className="p-12 text-center"><Zap className="animate-pulse text-primary mx-auto" /></div>;

  const deckValidation = validateDeck(selectedBeys);

  return (
    <div className="space-y-16 text-left">
      {/* Parts Section */}
      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Layers className="text-primary" size={20} />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight italic">Parts Collection</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Add Part Form */}
          {!readOnly && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Add New Part</h3>
              <input
                type="text"
                placeholder="Part Name..."
                value={newPartName}
                onChange={(e) => setNewPartName(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
              />
              <select
                value={newPartType}
                onChange={(e) => setNewPartType(e.target.value as any)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
              >
                <option value="blade">Blade</option>
                <option value="ratchet">Ratchet</option>
                <option value="bit">Bit</option>
              </select>
              <button
                onClick={addPart}
                className="w-full py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Add Part
              </button>
            </div>
          )}

          {/* Parts List */}
          <div className={`${readOnly ? 'md:col-span-3' : 'md:col-span-2'} bg-card border border-border rounded-3xl p-6`}>
            {parts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {parts.map((part) => (
                  <div key={part.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-border/50 group">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-tight italic">{part.name}</div>
                      <div className="text-[8px] font-bold text-primary uppercase tracking-widest">{part.type}</div>
                    </div>
                    {!readOnly && (
                      <button
                        onClick={() => deletePart(part.id)}
                        className="p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No parts in collection</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Beyblades Section */}
      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Shield className="text-primary" size={20} />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight italic">Beyblades</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Create Bey Form */}
          {!readOnly && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Build Beyblade</h3>
              <input
                type="text"
                placeholder="Beyblade Name..."
                value={newBeyName}
                onChange={(e) => setNewBeyName(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
              />
              <select
                value={selectedBlade}
                onChange={(e) => setSelectedBlade(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">Select Blade</option>
                {parts.filter(p => p.type === 'blade').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select
                value={selectedRatchet}
                onChange={(e) => setSelectedRatchet(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">Select Ratchet</option>
                {parts.filter(p => p.type === 'ratchet').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select
                value={selectedBit}
                onChange={(e) => setSelectedBit(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">Select Bit</option>
                {parts.filter(p => p.type === 'bit').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button
                onClick={createBeyblade}
                className="w-full py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Assemble Bey
              </button>
            </div>
          )}

          {/* Beys List */}
          <div className={`${readOnly ? 'md:col-span-3' : 'md:col-span-2'} grid grid-cols-1 sm:grid-cols-2 gap-4`}>
            {beyblades.length > 0 ? (
              beyblades.map((bey) => (
                <div key={bey.id} className="bg-card border border-border rounded-2xl p-6 relative group">
                  {!readOnly && (
                    <button
                      onClick={() => deleteBeyblade(bey.id)}
                      className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <div className="text-lg font-black uppercase tracking-tight italic mb-4">{bey.name}</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground uppercase font-bold">Blade</span>
                      <span className="font-black italic">{(bey as any).blade?.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground uppercase font-bold">Ratchet</span>
                      <span className="font-black italic">{(bey as any).ratchet?.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground uppercase font-bold">Bit</span>
                      <span className="font-black italic">{(bey as any).bit?.name}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center bg-card border border-border rounded-3xl">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No beyblades assembled</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Decks Section */}
      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Zap className="text-primary" size={20} />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight italic">Saved Decks</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Create Deck Form */}
          {!readOnly && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Build Deck (3 Beys)</h3>
              <input
                type="text"
                placeholder="Deck Name..."
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
              />
              {[0, 1, 2].map(i => (
                <select
                  key={i}
                  value={selectedBeys[i]}
                  onChange={(e) => {
                    const newSelected = [...selectedBeys];
                    newSelected[i] = e.target.value;
                    setSelectedBeys(newSelected);
                  }}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">Select Beyblade {i + 1}</option>
                  {beyblades.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              ))}

              {!deckValidation.valid && selectedBeys.every(id => id) && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                  <AlertCircle className="text-red-500 shrink-0" size={14} />
                  <p className="text-[8px] font-bold text-red-500 uppercase leading-relaxed">{deckValidation.error}</p>
                </div>
              )}

              <button
                onClick={createDeck}
                disabled={!deckValidation.valid || !newDeckName}
                className="w-full py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
              >
                Save Deck
              </button>
            </div>
          )}

          {/* Decks List */}
          <div className={`${readOnly ? 'md:col-span-3' : 'md:col-span-2'} grid grid-cols-1 sm:grid-cols-2 gap-4`}>
            {decks.length > 0 ? (
              decks.map((deck) => (
                <div key={deck.id} className="bg-card border border-border rounded-2xl p-6 relative group">
                  {!readOnly && (
                    <button
                      onClick={() => deleteDeck(deck.id)}
                      className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <div className="text-lg font-black uppercase tracking-tight italic mb-4">{deck.name}</div>
                  <div className="space-y-3">
                    {[(deck as any).bey1, (deck as any).bey2, (deck as any).bey3].map((bey, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                        <div className="w-6 h-6 bg-primary/20 rounded flex items-center justify-center text-[10px] font-black text-primary italic">
                          {i + 1}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-widest">{bey?.name || 'Unknown'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center bg-card border border-border rounded-3xl">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No decks saved</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
