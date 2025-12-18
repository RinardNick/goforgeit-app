'use client';

import { IntermediateResponse } from '@/lib/adk/evaluation-types';

export interface IntermediateResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  intermediateResponses: IntermediateResponse[];
  availableSubAgents: string[];
  onAddResponse: () => void;
  onRemoveResponse: (index: number) => void;
  onUpdateResponse: (index: number, field: 'agent' | 'text', value: string) => void;
  onSave: () => void;
}

export function IntermediateResponseModal({
  isOpen,
  onClose,
  intermediateResponses,
  availableSubAgents,
  onAddResponse,
  onRemoveResponse,
  onUpdateResponse,
  onSave,
}: IntermediateResponseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">Intermediate Responses</h2>
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
          {intermediateResponses.map((resp, index) => (
            <div key={index} className="p-4 border border-border rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">Sub-agent {index + 1}</span>
                <button
                  onClick={() => onRemoveResponse(index)}
                  className="text-destructive text-xs"
                >
                  Remove
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Sub-agent Name</label>
                  <select
                    data-testid="sub-agent-selector"
                    value={resp[0]}
                    onChange={(e) => onUpdateResponse(index, 'agent', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {availableSubAgents.map(agentName => (
                      <option key={agentName} value={agentName}>{agentName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Expected Response</label>
                  <textarea
                    data-testid="intermediate-response-text"
                    value={resp[1][0].text}
                    onChange={(e) => onUpdateResponse(index, 'text', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Sub-agent response..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onAddResponse}
          className="w-full px-4 py-2 text-purple-600 border-2 border-dashed border-purple-300 rounded-lg hover:bg-purple-50 transition-colors mb-6"
        >
          + Add Sub-agent Response
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
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Save Responses
          </button>
        </div>
      </div>
    </div>
  );
}
