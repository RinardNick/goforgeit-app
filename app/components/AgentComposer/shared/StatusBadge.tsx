'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

interface StatusBadgeProps {
  status: ConnectionStatus;
}

/**
 * A status badge component that displays connection status with appropriate
 * styling and icons. Used across MCP tools and other panels.
 */
export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = {
    connected: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', label: 'ONLINE' },
    disconnected: { icon: AlertCircle, color: 'text-muted-foreground/40', bg: 'bg-muted', label: 'OFFLINE' },
    error: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'ERROR' },
    connecting: { icon: Loader2, color: 'text-primary', bg: 'bg-primary/10', label: 'SYNC' },
  };

  const { icon: Icon, color, bg, label } = config[status];

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono border border-current opacity-80 ${bg} ${color}`}>
      <Icon size={10} className={status === 'connecting' ? 'animate-spin' : ''} />
      <span className="tracking-widest">{label}</span>
    </div>
  );
};
