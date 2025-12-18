/**
 * StatePanel Component
 *
 * Displays session and user state with key-value pairs.
 * Highlights changed state values and shows scope badges.
 * Supports inline editing and adding new state entries.
 */

'use client';

import { useState } from 'react';
import type { StateEntry } from './types';

interface StatePanelProps {
  sessionState: StateEntry[];
  onStateUpdate?: (key: string, value: unknown) => Promise<void>;
}

export function StatePanel({ sessionState, onStateUpdate }: StatePanelProps) {
  // Editing state
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Add new state entry
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleEdit = (entry: StateEntry) => {
    setEditingKey(entry.key);
    setEditValue(
      typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value, null, 2)
    );
  };

  const handleSave = async () => {
    if (!editingKey || !onStateUpdate) return;

    setIsSaving(true);
    try {
      // Try to parse as JSON, otherwise use as string
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(editValue);
      } catch {
        parsedValue = editValue;
      }
      await onStateUpdate(editingKey, parsedValue);
      setEditingKey(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to save state:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const handleAddState = async () => {
    if (!newKey.trim() || !onStateUpdate) return;

    setIsAdding(true);
    try {
      // Try to parse as JSON, otherwise use as string
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(newValue);
      } catch {
        parsedValue = newValue;
      }
      await onStateUpdate(newKey.trim(), parsedValue);
      setNewKey('');
      setNewValue('');
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to add state:', error);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      {/* Add State Button */}
      {onStateUpdate && (
        <div className="p-3 border-b border-border bg-muted/30">
          {!showAddForm ? (
            <button
              data-testid="add-state-btn"
              onClick={() => setShowAddForm(true)}
              className="w-full px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 rounded-sm hover:bg-primary/20 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add State Entry
            </button>
          ) : (
            <div className="space-y-3 p-1">
              <input
                data-testid="new-state-key-input"
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Key"
                className="w-full px-3 py-2 text-xs bg-background border border-border text-foreground rounded-sm focus:ring-1 focus:ring-primary focus:border-primary font-mono"
              />
              <input
                data-testid="new-state-value-input"
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Value (JSON or string)"
                className="w-full px-3 py-2 text-xs bg-background border border-border text-foreground rounded-sm focus:ring-1 focus:ring-primary focus:border-primary font-mono"
              />
              <div className="flex gap-2">
                <button
                  data-testid="save-new-state-btn"
                  onClick={handleAddState}
                  disabled={!newKey.trim() || isAdding}
                  className="flex-1 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-widest text-primary-foreground bg-primary rounded-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isAdding ? 'Adding...' : 'Confirm'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewKey('');
                    setNewValue('');
                  }}
                  className="px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground border border-border rounded-sm hover:bg-accent transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {sessionState.length > 0 ? (
        <div data-testid="state-viewer-panel" className="p-3 bg-background">
          <div className="space-y-3">
            {sessionState.map((entry) => (
              <div
                key={entry.key}
                data-testid="state-key-value"
                className={`text-xs p-4 rounded-sm bg-card border border-border transition-all hover:border-primary/30 shadow-sm ${
                  entry.changed ? 'border-primary/50 bg-primary/5' : ''
                }`}
              >
                {editingKey === entry.key ? (
                  // Editing mode
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span
                        data-testid="state-scope-badge"
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wide ${
                          entry.scope === 'user' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        {entry.scope}
                      </span>
                      <span data-testid="state-key" className="font-bold text-foreground font-mono">{entry.key}</span>
                    </div>
                    <textarea
                      data-testid="state-value-editor"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-background border border-border text-foreground rounded-sm focus:ring-1 focus:ring-primary focus:border-primary min-h-[80px] leading-relaxed"
                      rows={3}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={handleCancel}
                        className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground border border-border rounded-sm hover:bg-accent"
                      >
                        Cancel
                      </button>
                      <button
                        data-testid="save-state-btn"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-primary-foreground bg-primary rounded-sm hover:opacity-90 disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Update'}
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        data-testid="state-scope-badge"
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wide ${
                          entry.scope === 'user' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        {entry.scope}
                      </span>
                      <span data-testid="state-key" className="font-bold text-foreground font-mono tracking-tight">{entry.key}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span data-testid="state-value" className={`font-mono text-xs ${entry.changed ? 'text-primary' : 'text-muted-foreground opacity-80'}`}>
                        {typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)}
                      </span>
                      {entry.changed && <span data-testid="state-value-changed" className="text-primary text-[10px] bg-primary/10 px-2 py-0.5 rounded-full font-mono font-bold uppercase animate-pulse">changed</span>}
                      {onStateUpdate && (
                        <button
                          data-testid="edit-state-btn"
                          onClick={() => handleEdit(entry)}
                          className="p-1 text-muted-foreground/40 hover:text-primary rounded transition-colors"
                          title="Edit state"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div data-testid="state-viewer-panel" className="flex flex-col items-center justify-center h-full text-center p-4 bg-background">
          <svg className="w-12 h-12 text-muted-foreground/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          <p data-testid="state-empty-state" className="text-sm text-muted-foreground font-medium">No state data detected</p>
          <p className="text-xs text-muted-foreground/60 mt-1 font-light">Session state parameters will manifest here during execution.</p>
        </div>
      )}
    </div>
  );
}
