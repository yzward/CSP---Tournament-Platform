'use client';

import { Shield, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

export default function PendingPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-card border border-border rounded-[2.5rem] p-12 shadow-2xl text-center"
      >
        <div className="w-20 h-20 bg-amber-500 rounded-3xl flex items-center justify-center shadow-xl shadow-amber-500/20 mx-auto mb-8">
          <Clock className="text-white" size={40} />
        </div>
        
        <h1 className="text-4xl font-black uppercase tracking-tighter italic mb-4">
          Account <span className="text-amber-500">Pending</span>
        </h1>
        <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px] mb-12">
          Your request is being reviewed by an admin
        </p>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left">
          <p className="text-xs font-medium text-muted-foreground leading-relaxed">
            Welcome to Clash Stats Pro! To maintain the integrity of our rankings and scoring, all new accounts must be manually verified.
            <br /><br />
            This usually takes less than 24 hours. You will be able to access the full dashboard once approved.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-primary hover:text-primary/80 transition-colors"
        >
          Return to Home
        </Link>
      </motion.div>
    </div>
  );
}
