'use client';

import { ToolUse } from '@/lib/adk/evaluation-types';

export interface ToolTrajectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolTrajectory: ToolUse[];
  availableTools: string[];
  onAddTool: () => void;
  onRemoveTool: (index: number) => void;
  onUpdateTool: (index: number, field: 'name' | 'args', value: string) => void;
  onSave: () => void;
}

export function ToolTrajectoryModal({
  isOpen,
  onClose,
  toolTrajectory,
  availableTools,
  onAddTool,
  onRemoveTool,
  onUpdateTool,
  onSave,
}: ToolTrajectoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">Tool Trajectory</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-muted-foreground"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 mb-6">
          {toolTrajectory.map((tool, index) => (
            <div key={tool.id} className="p-4 border border-border rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">Tool {index + 1}</span>
                <button
                  onClick={() => onRemoveTool(index)}
                  className="text-destructive text-xs"
                >
                  Remove
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Tool Name</label>
                  <select
                    data-testid={`tool-selector-${index}`}
                    value={tool.name}
                    onChange={(e) => onUpdateTool(index, 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {availableTools.map(toolName => (
                      <option key={toolName} value={toolName}>{toolName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Arguments (JSON)</label>
                  <textarea
                    data-testid={`tool-args-input-${index}`}
                    value={JSON.stringify(tool.args, null, 2)}
                    onChange={(e) => onUpdateTool(index, 'args', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs"
                    placeholder='{"query": "test"}'
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          data-testid="add-tool-to-trajectory-btn"
          onClick={onAddTool}
          className="w-full px-4 py-2 text-primary border-2 border-dashed border-blue-300 rounded-lg hover:bg-primary/10 transition-colors mb-6"
        >
          + Add Tool
        </button>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-foreground border border-border rounded-lg hover:bg-muted/30"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90"
          >
            Save Tools
          </button>
        </div>
      </div>
    </div>
  );
}
