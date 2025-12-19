'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Code, Trash2, Plus, ChevronDown } from 'lucide-react';

/**
 * Callback configuration for agents
 * Stored in YAML as:
 * before_model_callbacks:
 *   - name: my_library.callbacks.function_name
 */

export type CallbackType =
  | 'before_agent'
  | 'after_agent'
  | 'before_model'
  | 'after_model'
  | 'before_tool'
  | 'after_tool';

export interface CallbackConfig {
  id: string;
  type: CallbackType;
  functionPath: string;
}

// Human-readable labels for callback types
const callbackTypeLabels: Record<CallbackType, string> = {
  before_agent: 'Before Agent',
  after_agent: 'After Agent',
  before_model: 'Before Model',
  after_model: 'After Model',
  before_tool: 'Before Tool',
  after_tool: 'After Tool',
};

// Description for each callback type
const callbackTypeDescriptions: Record<CallbackType, string> = {
  before_agent: 'Runs before the agent starts processing',
  after_agent: 'Runs after the agent completes',
  before_model: 'Runs before LLM calls',
  after_model: 'Runs after receiving LLM responses',
  before_tool: 'Runs before tool execution',
  after_tool: 'Runs after tool completion',
};

interface CallbacksPanelProps {
  callbacks: CallbackConfig[];
  onAddCallback: (type: CallbackType, functionPath: string) => void;
  onDeleteCallback: (id: string) => void;
}

// Dropdown for selecting callback type
function CallbackTypeDropdown({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: CallbackType) => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const callbackTypes: CallbackType[] = [
    'before_agent',
    'after_agent',
    'before_model',
    'after_model',
    'before_tool',
    'after_tool',
  ];

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-1 bg-popover rounded-lg shadow-lg border border-border py-1 z-50 min-w-[180px]"
    >
      {callbackTypes.map((type) => (
        <button
          key={type}
          onClick={() => {
            onSelect(type);
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex flex-col"
          data-testid={`callback-type-${type}`}
        >
          <span className="font-medium text-popover-foreground">
            {callbackTypeLabels[type]}
          </span>
          <span className="text-xs text-muted-foreground">
            {callbackTypeDescriptions[type]}
          </span>
        </button>
      ))}
    </div>
  );
}

// Dialog for adding a callback with function path
function AddCallbackDialog({
  isOpen,
  callbackType,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  callbackType: CallbackType | null;
  onClose: () => void;
  onSave: (functionPath: string) => void;
}) {
  const [functionPath, setFunctionPath] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (!functionPath.trim()) {
      setError('Function path is required');
      return;
    }

    // Basic validation: should look like a Python module path
    if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(functionPath)) {
      setError('Invalid function path format (e.g., my_library.callbacks.function_name)');
      return;
    }

    onSave(functionPath.trim());
    setFunctionPath('');
    setError(null);
    onClose();
  };

  const handleClose = () => {
    setFunctionPath('');
    setError(null);
    onClose();
  };

  if (!isOpen || !callbackType) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50" data-testid="add-callback-dialog">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md mx-4 border border-border">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-lg font-heading font-bold text-card-foreground">
            Add {callbackTypeLabels[callbackType]} Callback
          </h3>
          <p className="text-sm text-muted-foreground">
            {callbackTypeDescriptions[callbackType]}
          </p>
        </div>

        <div className="p-4 space-y-4">
          {/* Function Path Input */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Function Path
            </label>
            <input
              type="text"
              value={functionPath}
              onChange={(e) => setFunctionPath(e.target.value)}
              placeholder="my_library.callbacks.function_name"
              className={`w-full px-3 py-2 text-sm bg-background border rounded-md text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-colors ${
                error ? 'border-destructive' : 'border-border'
              }`}
              data-testid="callback-function-name-input"
            />
            {error && (
              <p className="mt-1 text-xs text-destructive">{error}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Fully qualified path to your Python callback function
            </p>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border flex justify-end gap-2 bg-muted/30">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:opacity-90 rounded-md font-medium transition-opacity"
            data-testid="add-callback-submit"
          >
            Add Callback
          </button>
        </div>
      </div>
    </div>
  );
}

// Card for displaying a callback
function CallbackCard({
  callback,
  onDelete,
}: {
  callback: CallbackConfig;
  onDelete: () => void;
}) {
  return (
    <div
      className="p-3 bg-card rounded-lg border border-border"
      data-testid="callback-card"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Code className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">
              {callbackTypeLabels[callback.type]}
            </p>
            <p className="text-sm text-card-foreground font-mono truncate">
              {callback.functionPath}
            </p>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
          title="Delete"
          data-testid="delete-callback-button"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function CallbacksPanel({
  callbacks,
  onAddCallback,
  onDeleteCallback,
}: CallbacksPanelProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCallbackType, setSelectedCallbackType] = useState<CallbackType | null>(null);

  const handleSelectCallbackType = (type: CallbackType) => {
    setSelectedCallbackType(type);
    setDialogOpen(true);
  };

  const handleSaveCallback = (functionPath: string) => {
    if (selectedCallbackType) {
      onAddCallback(selectedCallbackType, functionPath);
    }
    setSelectedCallbackType(null);
  };

  // Group callbacks by type for display
  const groupedCallbacks = callbacks.reduce((acc, callback) => {
    if (!acc[callback.type]) {
      acc[callback.type] = [];
    }
    acc[callback.type].push(callback);
    return acc;
  }, {} as Record<CallbackType, CallbackConfig[]>);

  return (
    <div className="space-y-3" data-testid="callbacks-section">
      <div className="flex items-center justify-between relative">
        <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
          Callbacks
        </h4>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1 p-1 text-muted-foreground hover:text-primary rounded transition-colors"
          title="Add Callback"
          data-testid="add-callback-button"
        >
          <Plus className="w-4 h-4" />
          <ChevronDown className="w-3 h-3" />
        </button>
        <CallbackTypeDropdown
          isOpen={dropdownOpen}
          onClose={() => setDropdownOpen(false)}
          onSelect={handleSelectCallbackType}
        />
      </div>

      {callbacks.length === 0 ? (
        <div
          className="text-center py-4 bg-muted/20 rounded-lg border border-dashed border-border"
          data-testid="callbacks-empty-state"
        >
          <Code className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-[10px] text-muted-foreground/60 font-mono uppercase mb-2">No callbacks configured</p>
          <button
            onClick={() => setDropdownOpen(true)}
            className="text-xs font-bold text-primary hover:text-primary/80 hover:underline uppercase tracking-wide transition-colors"
          >
            Add callback
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {callbacks.map((callback) => (
            <CallbackCard
              key={callback.id}
              callback={callback}
              onDelete={() => onDeleteCallback(callback.id)}
            />
          ))}
        </div>
      )}

      <AddCallbackDialog
        isOpen={dialogOpen}
        callbackType={selectedCallbackType}
        onClose={() => {
          setDialogOpen(false);
          setSelectedCallbackType(null);
        }}
        onSave={handleSaveCallback}
      />
    </div>
  );
}
