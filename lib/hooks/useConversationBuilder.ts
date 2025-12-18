'use client';

import { useState, useCallback } from 'react';
import {
  EvalCase,
  ConversationTurn,
  ToolUse,
  IntermediateResponse,
  createConversationTurn,
  createToolUse,
  createEvalCase,
} from '@/lib/adk/evaluation-types';

export interface UseConversationBuilderOptions {
  agentName: string;
  evalsetId: string;
  apiBasePath: '/api/agents' | '/api/adk-agents';
  onEvalsetUpdate: (evalset: unknown) => void;
}

export interface UseConversationBuilderReturn {
  // Conversation builder state
  showConversationBuilder: boolean;
  editingConversationId: string | null;
  currentConversation: ConversationTurn[];
  currentUserId: string;
  currentInitialState: string;
  saving: boolean;
  saveError: string | null;
  showSessionConfig: boolean;

  // Tool trajectory state
  activeTurnIndex: number | null;
  showToolTrajectoryBuilder: boolean;
  toolTrajectory: ToolUse[];

  // Intermediate response state
  showIntermediateBuilder: boolean;
  intermediateResponses: IntermediateResponse[];

  // Conversation modal actions
  openAddConversation: () => void;
  openEditConversation: (evalCase: EvalCase) => void;
  closeConversationBuilder: () => void;
  toggleSessionConfig: () => void;
  setUserId: (userId: string) => void;
  setInitialState: (state: string) => void;

  // Turn actions
  addTurn: () => void;
  updateTurn: (index: number, field: 'user' | 'expected', value: string) => void;
  removeTurn: (index: number) => void;

  // Tool trajectory actions
  openToolTrajectory: (turnIndex: number) => void;
  closeToolTrajectory: () => void;
  addTool: () => void;
  updateTool: (index: number, field: 'name' | 'args', value: string) => void;
  removeTool: (index: number) => void;
  saveToolTrajectory: () => void;

  // Intermediate response actions
  openIntermediateResponses: (turnIndex: number) => void;
  closeIntermediateResponses: () => void;
  addIntermediateResponse: () => void;
  updateIntermediateResponse: (index: number, field: 'agent' | 'text', value: string) => void;
  removeIntermediateResponse: (index: number) => void;
  saveIntermediateResponses: () => void;

  // API actions
  saveConversation: (evalset: { eval_cases: EvalCase[] }) => Promise<void>;
  deleteConversation: (evalCaseId: string, evalset: { eval_cases: EvalCase[] }) => Promise<void>;
}

/**
 * Hook for managing conversation builder state in evaluation pages.
 * Extracts complex conversation editing logic from evaluation pages.
 */
export function useConversationBuilder({
  agentName,
  evalsetId,
  apiBasePath,
  onEvalsetUpdate,
}: UseConversationBuilderOptions): UseConversationBuilderReturn {
  // Conversation builder state
  const [showConversationBuilder, setShowConversationBuilder] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [currentConversation, setCurrentConversation] = useState<ConversationTurn[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentInitialState, setCurrentInitialState] = useState('{}');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSessionConfig, setShowSessionConfig] = useState(false);

  // Tool trajectory state
  const [activeTurnIndex, setActiveTurnIndex] = useState<number | null>(null);
  const [showToolTrajectoryBuilder, setShowToolTrajectoryBuilder] = useState(false);
  const [toolTrajectory, setToolTrajectory] = useState<ToolUse[]>([]);

  // Intermediate response state
  const [showIntermediateBuilder, setShowIntermediateBuilder] = useState(false);
  const [intermediateResponses, setIntermediateResponses] = useState<IntermediateResponse[]>([]);

  // Conversation modal actions
  const openAddConversation = useCallback(() => {
    setEditingConversationId(null);
    setCurrentConversation([createConversationTurn('', '')]);
    setCurrentUserId(`eval-user-${Date.now()}`);
    setCurrentInitialState('{}');
    setShowConversationBuilder(true);
  }, []);

  const openEditConversation = useCallback((evalCase: EvalCase) => {
    setEditingConversationId(evalCase.eval_id);
    setCurrentConversation([...evalCase.conversation]);
    setCurrentUserId(evalCase.session_input.user_id);
    setCurrentInitialState(JSON.stringify(evalCase.session_input.state || {}, null, 2));
    setShowConversationBuilder(true);
  }, []);

  const closeConversationBuilder = useCallback(() => {
    setShowConversationBuilder(false);
    setSaveError(null);
  }, []);

  const toggleSessionConfig = useCallback(() => {
    setShowSessionConfig((prev) => !prev);
  }, []);

  // Turn actions
  const addTurn = useCallback(() => {
    setCurrentConversation((prev) => [...prev, createConversationTurn('', '')]);
  }, []);

  const updateTurn = useCallback((index: number, field: 'user' | 'expected', value: string) => {
    setCurrentConversation((prev) => {
      const updated = [...prev];
      if (field === 'user') {
        updated[index] = {
          ...updated[index],
          user_content: { parts: [{ text: value }], role: 'user' },
        };
      } else {
        updated[index] = {
          ...updated[index],
          final_response: {
            parts: [{ text: value }],
            role: 'model',
          },
        };
      }
      return updated;
    });
  }, []);

  const removeTurn = useCallback((index: number) => {
    setCurrentConversation((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Tool trajectory actions
  const openToolTrajectory = useCallback((turnIndex: number) => {
    setActiveTurnIndex(turnIndex);
    setToolTrajectory(currentConversation[turnIndex]?.intermediate_data?.tool_uses || []);
    setShowToolTrajectoryBuilder(true);
  }, [currentConversation]);

  const closeToolTrajectory = useCallback(() => {
    setShowToolTrajectoryBuilder(false);
  }, []);

  const addTool = useCallback(() => {
    setToolTrajectory((prev) => [...prev, createToolUse('google_search', {})]);
  }, []);

  const updateTool = useCallback((index: number, field: 'name' | 'args', value: string) => {
    setToolTrajectory((prev) => {
      const updated = [...prev];
      if (field === 'name') {
        updated[index] = { ...updated[index], name: value };
      } else {
        try {
          updated[index] = { ...updated[index], args: JSON.parse(value) };
        } catch {
          // Keep old args if invalid JSON
        }
      }
      return updated;
    });
  }, []);

  const removeTool = useCallback((index: number) => {
    setToolTrajectory((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const saveToolTrajectory = useCallback(() => {
    if (activeTurnIndex !== null) {
      setCurrentConversation((prev) => {
        const updated = [...prev];
        updated[activeTurnIndex] = {
          ...updated[activeTurnIndex],
          intermediate_data: {
            ...updated[activeTurnIndex].intermediate_data,
            tool_uses: toolTrajectory,
          },
        };
        return updated;
      });
    }
    setShowToolTrajectoryBuilder(false);
  }, [activeTurnIndex, toolTrajectory]);

  // Intermediate response actions
  const openIntermediateResponses = useCallback((turnIndex: number) => {
    setActiveTurnIndex(turnIndex);
    setIntermediateResponses(
      currentConversation[turnIndex]?.intermediate_data?.intermediate_responses || []
    );
    setShowIntermediateBuilder(true);
  }, [currentConversation]);

  const closeIntermediateResponses = useCallback(() => {
    setShowIntermediateBuilder(false);
  }, []);

  const addIntermediateResponse = useCallback(() => {
    setIntermediateResponses((prev) => [...prev, ['copywriting_agent', [{ text: '' }]]]);
  }, []);

  const updateIntermediateResponse = useCallback(
    (index: number, field: 'agent' | 'text', value: string) => {
      setIntermediateResponses((prev) => {
        const updated = [...prev];
        if (field === 'agent') {
          updated[index] = [value, updated[index][1]];
        } else {
          updated[index] = [updated[index][0], [{ text: value }]];
        }
        return updated;
      });
    },
    []
  );

  const removeIntermediateResponse = useCallback((index: number) => {
    setIntermediateResponses((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const saveIntermediateResponses = useCallback(() => {
    if (activeTurnIndex !== null) {
      setCurrentConversation((prev) => {
        const updated = [...prev];
        updated[activeTurnIndex] = {
          ...updated[activeTurnIndex],
          intermediate_data: {
            ...updated[activeTurnIndex].intermediate_data,
            intermediate_responses: intermediateResponses,
          },
        };
        return updated;
      });
    }
    setShowIntermediateBuilder(false);
  }, [activeTurnIndex, intermediateResponses]);

  // API actions
  const saveConversation = useCallback(
    async (evalset: { eval_cases: EvalCase[] }) => {
      setSaving(true);
      setSaveError(null);

      try {
        // Parse initial state
        let parsedState = {};
        try {
          parsedState = JSON.parse(currentInitialState);
        } catch {
          throw new Error('Invalid JSON in initial state');
        }

        // Create eval case
        const evalCase = createEvalCase(agentName, currentConversation, currentUserId, parsedState);

        // If editing, replace existing; otherwise add new
        let updatedEvalCases = [...evalset.eval_cases];
        if (editingConversationId) {
          const index = updatedEvalCases.findIndex((ec) => ec.eval_id === editingConversationId);
          if (index >= 0) {
            evalCase.eval_id = editingConversationId;
            updatedEvalCases[index] = evalCase;
          }
        } else {
          updatedEvalCases.push(evalCase);
        }

        // Save to API
        const response = await fetch(`${apiBasePath}/${agentName}/evaluations/${evalsetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eval_cases: updatedEvalCases }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to save conversation');
        }

        onEvalsetUpdate(data.evalset);
        setShowConversationBuilder(false);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save conversation');
      } finally {
        setSaving(false);
      }
    },
    [
      agentName,
      evalsetId,
      apiBasePath,
      currentConversation,
      currentUserId,
      currentInitialState,
      editingConversationId,
      onEvalsetUpdate,
    ]
  );

  const deleteConversation = useCallback(
    async (evalCaseId: string, evalset: { eval_cases: EvalCase[] }) => {
      if (!confirm('Delete this conversation?')) return;

      try {
        const updatedEvalCases = evalset.eval_cases.filter((ec) => ec.eval_id !== evalCaseId);

        const response = await fetch(`${apiBasePath}/${agentName}/evaluations/${evalsetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eval_cases: updatedEvalCases }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to delete conversation');
        }

        onEvalsetUpdate(data.evalset);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete conversation');
      }
    },
    [agentName, evalsetId, apiBasePath, onEvalsetUpdate]
  );

  return {
    // Conversation builder state
    showConversationBuilder,
    editingConversationId,
    currentConversation,
    currentUserId,
    currentInitialState,
    saving,
    saveError,
    showSessionConfig,

    // Tool trajectory state
    activeTurnIndex,
    showToolTrajectoryBuilder,
    toolTrajectory,

    // Intermediate response state
    showIntermediateBuilder,
    intermediateResponses,

    // Conversation modal actions
    openAddConversation,
    openEditConversation,
    closeConversationBuilder,
    toggleSessionConfig,
    setUserId: setCurrentUserId,
    setInitialState: setCurrentInitialState,

    // Turn actions
    addTurn,
    updateTurn,
    removeTurn,

    // Tool trajectory actions
    openToolTrajectory,
    closeToolTrajectory,
    addTool,
    updateTool,
    removeTool,
    saveToolTrajectory,

    // Intermediate response actions
    openIntermediateResponses,
    closeIntermediateResponses,
    addIntermediateResponse,
    updateIntermediateResponse,
    removeIntermediateResponse,
    saveIntermediateResponses,

    // API actions
    saveConversation,
    deleteConversation,
  };
}
