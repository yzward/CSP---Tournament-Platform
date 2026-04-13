'use client';

import { ShieldAlert, ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';

export default function NotAuthorisedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a12]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-card border border-border rounded-[2.5rem] p-12 text-center shadow-2xl"
      >
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-500/20">
          <ShieldAlert className="text-red-500" size={40} />
        </div>
        
        <h1 className="text-3xl font-black uppercase tracking-tighter italic mb-4">
          Access <span className="text-red-500">Denied</span>
        </h1>
        
        <p className="text-muted-foreground font-medium mb-12 leading-relaxed">
          You must be a member of the CLASH Discord server to access this platform.
        </p>
        
        <div className="space-y-4">
          <a 
            href="https://discord.gg/clash" // Placeholder invite link
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 bg-[#5865F2] text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[#5865F2]/20"
          >
            Join Discord Server <ExternalLink size={16} />
          </a>
          
          <Link 
            href="/login"
            className="flex items-center justify-center gap-2 w-full py-4 bg-white/5 text-muted-foreground rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all"
          >
            <ArrowLeft size={16} /> Back to Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
