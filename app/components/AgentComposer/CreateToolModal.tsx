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
      <div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-full text-primary">
                <Wrench size={20} />
              </div>
              <h2 className="text-lg font-heading font-bold text-foreground">Forge New Tool</h2>
            </div>
            <button 
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            Describe the tool you want to build. Our Forge agent will write the Python code for you.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Tool Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="E.g., A tool that takes a stock ticker symbol and returns the current price using Yahoo Finance."
                  className="w-full h-32 px-3 py-2 bg-background border border-border rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none placeholder:text-muted-foreground/40"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText="Forging..."
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg"
                  disabled={!description.trim()}
                >
                  <Sparkles size={16} />
                  Forge Tool
                </LoadingButton>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
