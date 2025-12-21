'use client';

import React, { useState } from 'react';
import { Wrench, Sparkles, X, ArrowRight } from 'lucide-react';
import { LoadingButton } from '@/components/ui/LoadingButton';

interface CreateToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (description: string) => Promise<void>;
}

export function CreateToolModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateToolModalProps) {
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(description);
      onClose();
      setDescription('');
    } catch (error) {
      console.error('Failed to submit tool request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-card border border-border/50 rounded-lg shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-300 backdrop-blur-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-sm text-primary shadow-inner">
                <Wrench size={20} />
              </div>
              <div>
                <h2 className="text-lg font-heading font-bold text-foreground uppercase tracking-tight">The_Forge</h2>
                <p className="text-[10px] font-mono text-primary/60 uppercase tracking-widest">TRANSMUTATION_ENGINE_v3.0</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors rounded-full hover:bg-muted"
            >
              <X size={20} />
            </button>
          </div>

          <p className="text-xs text-muted-foreground mb-8 leading-relaxed font-mono uppercase tracking-tight opacity-70">
            Describe the capability you wish to manifest. The Forge will architect the implementation logic.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-widest font-mono mb-3">
                  MANIFESTATION_PROMPT
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="E.g., A tool that synthesizes market trends for a given asset..."
                  className="w-full h-32 px-4 py-3 bg-background/50 border border-border/50 rounded-sm text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none placeholder:text-muted-foreground/20 font-mono"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[10px] font-bold text-muted-foreground/40 hover:text-destructive uppercase tracking-widest font-mono transition-colors"
                >
                  ABORT_INITIATION
                </button>
                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText="TRANSMUTING..."
                  className="px-6 py-2.5 bg-primary text-primary-foreground rounded-sm text-[10px] font-bold uppercase tracking-widest font-mono flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                  disabled={!description.trim()}
                  variant="custom"
                >
                  <Sparkles size={14} />
                  FORGE_TOOL
                </LoadingButton>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
