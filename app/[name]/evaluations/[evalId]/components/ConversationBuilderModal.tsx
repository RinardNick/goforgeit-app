'use client';

import { LoadingButton } from '@/components/ui/LoadingButton';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import {
  ConversationTurn,
  ToolUse,
  IntermediateResponse,
} from '@/lib/adk/evaluation-types';

export interface ConversationBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingId: string | null;
  conversation: ConversationTurn[];
  userId: string;
  initialState: string;
  saving: boolean;
  saveError: string | null;
  showSessionConfig: boolean;
  onToggleSessionConfig: () => void;
  onUserIdChange: (value: string) => void;
  onInitialStateChange: (value: string) => void;
  onUpdateTurn: (index: number, field: 'user' | 'expected', value: string) => void;
  onAddTurn: () => void;
  onRemoveTurn: (index: number) => void;
  onOpenToolTrajectory: (index: number) => void;
  onOpenIntermediateResponses: (index: number) => void;
  onSave: () => void;
}

export function ConversationBuilderModal({
  isOpen,
  onClose,
  editingId,
  conversation,
  userId,
  initialState,
  saving,
  saveError,
  showSessionConfig,
  onToggleSessionConfig,
  onUserIdChange,
  onInitialStateChange,
  onUpdateTurn,
  onAddTurn,
  onRemoveTurn,
  onOpenToolTrajectory,
  onOpenIntermediateResponses,
  onSave,
}: ConversationBuilderModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">
            {editingId ? 'Edit' : 'Create'} Conversation
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-muted-foreground"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {saveError && <ErrorMessage message={saveError} className="mb-4" />}

        {/* Session Config */}
        <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
          <button
            data-testid="session-config-btn"
            onClick={onToggleSessionConfig}
            className="flex items-center gap-2 text-sm font-medium text-foreground mb-2"
          >
            <svg className={`w-4 h-4 transition-transform ${showSessionConfig ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Session Configuration
          </button>
          {showSessionConfig && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">User ID</label>
                <input
                  type="text"
                  data-testid="user-id-input"
                  value={userId}
                  onChange={(e) => onUserIdChange(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="eval-user-123"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Initial State (JSON)</label>
                <textarea
                  data-testid="initial-state-input"
                  value={initialState}
                  onChange={(e) => onInitialStateChange(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono text-sm"
                  placeholder='{"key": "value"}'
                />
              </div>
            </div>
          )}
        </div>

        {/* Turns */}
        <div className="space-y-4 mb-6">
          {conversation.map((turn, index) => (
            <div key={turn.invocation_id} className="p-4 border border-border rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-foreground">Turn {index + 1}</h3>
                <div className="flex gap-2">
                  <button
                    data-testid="add-tool-trajectory-btn"
                    onClick={() => onOpenToolTrajectory(index)}
                    className="px-2 py-1 text-xs text-primary border border-blue-300 rounded hover:bg-primary/10"
                  >
                    {turn.intermediate_data?.tool_uses?.length ? `${turn.intermediate_data.tool_uses.length} Tools` : '+ Tools'}
                  </button>
                  <button
                    data-testid="add-intermediate-response-btn"
                    onClick={() => onOpenIntermediateResponses(index)}
                    className="px-2 py-1 text-xs text-purple-600 border border-purple-300 rounded hover:bg-purple-50"
                  >
                    {turn.intermediate_data?.intermediate_responses?.length ? `${turn.intermediate_data.intermediate_responses.length} Sub-agents` : '+ Sub-agents'}
                  </button>
                  {conversation.length > 1 && (
                    <button
                      onClick={() => onRemoveTurn(index)}
                      className="px-2 py-1 text-xs text-destructive border border-red-300 rounded hover:bg-red-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">User Message</label>
                  <textarea
                    data-testid={`user-message-input-${index}`}
                    value={turn.user_content.parts[0].text}
                    onChange={(e) => onUpdateTurn(index, 'user', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="What is 2+2?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Expected Response</label>
                  <textarea
                    data-testid={`expected-response-input-${index}`}
                    value={turn.final_response?.parts[0].text || ''}
                    onChange={(e) => onUpdateTurn(index, 'expected', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="2+2 equals 4"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          data-testid="add-turn-btn"
          onClick={onAddTurn}
          className="w-full px-4 py-2 text-amber-600 border-2 border-dashed border-amber-300 rounded-lg hover:bg-amber-50 transition-colors mb-6"
        >
          + Add Turn
        </button>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-foreground border border-border rounded-lg hover:bg-muted/30"
          >
            Cancel
          </button>
          <LoadingButton
            testId="save-conversation-btn"
            onClick={onSave}
            isLoading={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90"
            variant="primary"
          >
            Save Conversation
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
