'use client';

import React from 'react';
import { Plus, X } from 'lucide-react';

export interface KeyValueItem {
  key: string;
  value: string;
}

interface KeyValueEditorProps {
  label: string;
  items: KeyValueItem[];
  onChange: (items: KeyValueItem[]) => void;
  placeholder?: { key: string; value: string };
}

/**
 * A reusable key-value editor component for editing environment variables,
 * headers, or other key-value pair configurations.
 */
export const KeyValueEditor = ({ label, items, onChange, placeholder }: KeyValueEditorProps) => {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono">{label}</label>
        <button
          type="button"
          onClick={() => onChange([...items, { key: '', value: '' }])}
          className="text-[10px] font-bold text-primary hover:text-primary/80 uppercase tracking-wide flex items-center gap-1 transition-colors"
        >
          <Plus size={12} /> Add Entry
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              placeholder={placeholder?.key || 'KEY'}
              className="flex-1 min-w-0 bg-background border border-border rounded-sm px-2 py-1.5 text-xs font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              value={item.key}
              onChange={(e) => {
                const newItems = [...items];
                newItems[idx].key = e.target.value;
                onChange(newItems);
              }}
            />
            <input
              placeholder={placeholder?.value || 'VALUE'}
              className="flex-1 min-w-0 bg-background border border-border rounded-sm px-2 py-1.5 text-xs font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              value={item.value}
              onChange={(e) => {
                const newItems = [...items];
                newItems[idx].value = e.target.value;
                onChange(newItems);
              }}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="text-muted-foreground/40 hover:text-destructive transition-colors px-1"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
