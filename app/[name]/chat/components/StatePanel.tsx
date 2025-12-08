/**
 * StatePanel Component
 *
 * Displays session and user state with key-value pairs.
 * Highlights changed state values and shows scope badges.
 * Supports inline editing and adding new state entries.
 */

'use client';

import { useState } from 'react';
import type { StateEntry } from '../types';

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
    <div className="flex-1 overflow-y-auto">
      {/* Add State Button */}
      {onStateUpdate && (
        <div className="p-3 border-b border-gray-200">
          {!showAddForm ? (
            <button
              data-testid="add-state-btn"
              onClick={() => setShowAddForm(true)}
              className="w-full px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add State
            </button>
          ) : (
            <div className="space-y-2">
              <input
                data-testid="new-state-key-input"
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Key"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                data-testid="new-state-value-input"
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Value (JSON or string)"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  data-testid="save-new-state-btn"
                  onClick={handleAddState}
                  disabled={!newKey.trim() || isAdding}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAdding ? 'Adding...' : 'Add'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewKey('');
                    setNewValue('');
                  }}
                  className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {sessionState.length > 0 ? (
        <div data-testid="state-viewer-panel" className="p-3">
          <div className="space-y-2">
            {sessionState.map((entry) => (
              <div
                key={entry.key}
                data-testid="state-key-value"
                className={`text-sm p-3 rounded-lg bg-gray-50 ${
                  entry.changed ? 'ring-1 ring-amber-200' : ''
                }`}
              >
                {editingKey === entry.key ? (
                  // Editing mode
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        data-testid="state-scope-badge"
                        className={`px-2 py-0.5 rounded text-xs ${
                          entry.scope === 'user' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {entry.scope}
                      </span>
                      <span data-testid="state-key" className="font-medium text-gray-900">{entry.key}</span>
                    </div>
                    <textarea
                      data-testid="state-value-editor"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                      rows={3}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={handleCancel}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        data-testid="save-state-btn"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        data-testid="state-scope-badge"
                        className={`px-2 py-0.5 rounded text-xs ${
                          entry.scope === 'user' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {entry.scope}
                      </span>
                      <span data-testid="state-key" className="font-medium text-gray-900">{entry.key}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span data-testid="state-value" className={`font-mono text-sm ${entry.changed ? 'text-amber-700' : 'text-gray-600'}`}>
                        {typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)}
                      </span>
                      {entry.changed && <span data-testid="state-value-changed" className="text-amber-600 text-xs bg-amber-50 px-2 py-0.5 rounded">changed</span>}
                      {onStateUpdate && (
                        <button
                          data-testid="edit-state-btn"
                          onClick={() => handleEdit(entry)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
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
        <div data-testid="state-viewer-panel" className="flex flex-col items-center justify-center h-full text-center p-4">
          <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          <p data-testid="state-empty-state" className="text-sm text-gray-500 font-medium">No state data</p>
          <p className="text-xs text-gray-400 mt-1">Session state will appear here when agents modify it</p>
        </div>
      )}
    </div>
  );
}
