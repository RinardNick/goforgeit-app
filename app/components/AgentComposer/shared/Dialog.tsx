'use client';

import { X, ChevronDown } from 'lucide-react';
import { ReactNode } from 'react';

// Shared dialog overlay - the backdrop and centering
interface DialogOverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function DialogOverlay({ open, onClose, children }: DialogOverlayProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      {children}
    </div>
  );
}

// Shared dialog card container
interface DialogCardProps {
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
  maxHeight?: boolean;
  testId?: string;
}

export function DialogCard({ children, maxWidth = 'md', maxHeight = false, testId }: DialogCardProps) {
  const widthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }[maxWidth];

  return (
    <div
      className={`bg-card rounded-xl shadow-2xl w-full ${widthClass} mx-4 overflow-hidden border border-border ${maxHeight ? 'max-h-[90vh] flex flex-col' : ''}`}
      onClick={e => e.stopPropagation()}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

// Shared dialog header
interface DialogHeaderProps {
  title: string;
  onClose: () => void;
  onBack?: () => void;
}

export function DialogHeader({ title, onClose, onBack }: DialogHeaderProps) {
  return (
    <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
      <div className="flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground p-1 -ml-1 transition-colors">
            <ChevronDown size={16} className="rotate-90" />
          </button>
        )}
        <h2 className="text-lg font-heading font-bold text-foreground uppercase tracking-tight">{title}</h2>
      </div>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
        <X size={20} />
      </button>
    </div>
  );
}

// Shared dialog footer
interface DialogFooterProps {
  children: ReactNode;
}

export function DialogFooter({ children }: DialogFooterProps) {
  return (
    <div className="px-5 py-4 border-t border-border flex justify-end gap-3 bg-muted/30 shrink-0">
      {children}
    </div>
  );
}

// Shared dialog body
interface DialogBodyProps {
  children: ReactNode;
  scrollable?: boolean;
}

export function DialogBody({ children, scrollable = false }: DialogBodyProps) {
  return (
    <div className={`p-5 space-y-4 bg-card ${scrollable ? 'overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent' : ''}`}>
      {children}
    </div>
  );
}

// Shared button styles
interface DialogButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}

export function DialogButton({ children, variant = 'secondary', onClick, disabled = false, testId }: DialogButtonProps) {
  if (variant === 'primary') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        data-testid={testId}
        className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest bg-primary text-primary-foreground rounded-sm hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}
