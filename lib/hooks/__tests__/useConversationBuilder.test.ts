import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';

// Mock types for testing the logic
interface ConversationTurn {
  invocation_id: string;
  user_content: { parts: { text: string }[] };
  final_response?: { parts: { text: string }[]; role: string };
  intermediate_data?: {
    tool_uses?: unknown[];
    intermediate_responses?: unknown[];
  };
}

interface EvalCase {
  eval_id: string;
  conversation: ConversationTurn[];
  session_input: {
    user_id: string;
    state?: Record<string, unknown>;
  };
}

describe('useConversationBuilder Hook Logic', () => {
  describe('createConversationTurn', () => {
    const createConversationTurn = (userText: string, expectedText: string): ConversationTurn => ({
      invocation_id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      user_content: { parts: [{ text: userText }] },
      final_response: expectedText ? { parts: [{ text: expectedText }], role: 'model' } : undefined,
    });

    it('should create a turn with user content', () => {
      const turn = createConversationTurn('Hello', '');
      assert.strictEqual(turn.user_content.parts[0].text, 'Hello');
    });

    it('should create a turn with expected response', () => {
      const turn = createConversationTurn('Hello', 'Hi there!');
      assert.strictEqual(turn.final_response?.parts[0].text, 'Hi there!');
    });

    it('should generate unique invocation ids', () => {
      const turn1 = createConversationTurn('A', 'B');
      const turn2 = createConversationTurn('A', 'B');
      assert.notStrictEqual(turn1.invocation_id, turn2.invocation_id);
    });
  });

  describe('handleUpdateTurn', () => {
    const createTurn = (text: string): ConversationTurn => ({
      invocation_id: 'test-id',
      user_content: { parts: [{ text }] },
    });

    const handleUpdateTurn = (
      conversation: ConversationTurn[],
      index: number,
      field: 'user' | 'expected',
      value: string
    ): ConversationTurn[] => {
      const updated = [...conversation];
      if (field === 'user') {
        updated[index] = {
          ...updated[index],
          user_content: { parts: [{ text: value }] },
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
    };

    it('should update user content', () => {
      const conversation = [createTurn('Original')];
      const updated = handleUpdateTurn(conversation, 0, 'user', 'Updated');
      assert.strictEqual(updated[0].user_content.parts[0].text, 'Updated');
    });

    it('should update expected response', () => {
      const conversation = [createTurn('User message')];
      const updated = handleUpdateTurn(conversation, 0, 'expected', 'Expected response');
      assert.strictEqual(updated[0].final_response?.parts[0].text, 'Expected response');
    });

    it('should not mutate original conversation', () => {
      const original = [createTurn('Original')];
      const updated = handleUpdateTurn(original, 0, 'user', 'Updated');
      assert.strictEqual(original[0].user_content.parts[0].text, 'Original');
      assert.notStrictEqual(original, updated);
    });
  });

  describe('handleAddTurn', () => {
    const createTurn = (): ConversationTurn => ({
      invocation_id: `inv-${Date.now()}`,
      user_content: { parts: [{ text: '' }] },
    });

    const handleAddTurn = (conversation: ConversationTurn[]): ConversationTurn[] => {
      return [...conversation, createTurn()];
    };

    it('should add a new turn to conversation', () => {
      const conversation: ConversationTurn[] = [];
      const updated = handleAddTurn(conversation);
      assert.strictEqual(updated.length, 1);
    });

    it('should preserve existing turns', () => {
      const existing: ConversationTurn = {
        invocation_id: 'existing',
        user_content: { parts: [{ text: 'Hello' }] },
      };
      const conversation = [existing];
      const updated = handleAddTurn(conversation);
      assert.strictEqual(updated.length, 2);
      assert.strictEqual(updated[0].invocation_id, 'existing');
    });
  });

  describe('handleRemoveTurn', () => {
    const createTurn = (id: string): ConversationTurn => ({
      invocation_id: id,
      user_content: { parts: [{ text: '' }] },
    });

    const handleRemoveTurn = (
      conversation: ConversationTurn[],
      index: number
    ): ConversationTurn[] => {
      if (conversation.length <= 1) {
        return conversation; // Keep at least one turn
      }
      return conversation.filter((_, i) => i !== index);
    };

    it('should remove turn at specified index', () => {
      const conversation = [createTurn('a'), createTurn('b'), createTurn('c')];
      const updated = handleRemoveTurn(conversation, 1);
      assert.strictEqual(updated.length, 2);
      assert.strictEqual(updated[0].invocation_id, 'a');
      assert.strictEqual(updated[1].invocation_id, 'c');
    });

    it('should not remove last turn', () => {
      const conversation = [createTurn('only')];
      const updated = handleRemoveTurn(conversation, 0);
      assert.strictEqual(updated.length, 1);
      assert.strictEqual(updated[0].invocation_id, 'only');
    });
  });

  describe('handleAddConversation', () => {
    interface ConversationBuilderState {
      editingId: string | null;
      conversation: ConversationTurn[];
      userId: string;
      initialState: string;
      isOpen: boolean;
    }

    const createDefaultState = (): ConversationBuilderState => ({
      editingId: null,
      conversation: [{
        invocation_id: 'new',
        user_content: { parts: [{ text: '' }] },
      }],
      userId: `eval-user-${Date.now()}`,
      initialState: '{}',
      isOpen: true,
    });

    const handleAddConversation = (): ConversationBuilderState => {
      return createDefaultState();
    };

    it('should set editingId to null for new conversation', () => {
      const state = handleAddConversation();
      assert.strictEqual(state.editingId, null);
    });

    it('should create one empty turn', () => {
      const state = handleAddConversation();
      assert.strictEqual(state.conversation.length, 1);
    });

    it('should set default initial state', () => {
      const state = handleAddConversation();
      assert.strictEqual(state.initialState, '{}');
    });

    it('should open the modal', () => {
      const state = handleAddConversation();
      assert.strictEqual(state.isOpen, true);
    });
  });

  describe('handleEditConversation', () => {
    interface ConversationBuilderState {
      editingId: string | null;
      conversation: ConversationTurn[];
      userId: string;
      initialState: string;
      isOpen: boolean;
    }

    const handleEditConversation = (evalCase: EvalCase): ConversationBuilderState => {
      return {
        editingId: evalCase.eval_id,
        conversation: [...evalCase.conversation],
        userId: evalCase.session_input.user_id,
        initialState: JSON.stringify(evalCase.session_input.state || {}, null, 2),
        isOpen: true,
      };
    };

    it('should set editingId to eval case id', () => {
      const evalCase: EvalCase = {
        eval_id: 'test-123',
        conversation: [],
        session_input: { user_id: 'user-1' },
      };
      const state = handleEditConversation(evalCase);
      assert.strictEqual(state.editingId, 'test-123');
    });

    it('should copy conversation from eval case', () => {
      const evalCase: EvalCase = {
        eval_id: 'test-123',
        conversation: [{
          invocation_id: 'inv-1',
          user_content: { parts: [{ text: 'Hello' }] },
        }],
        session_input: { user_id: 'user-1' },
      };
      const state = handleEditConversation(evalCase);
      assert.strictEqual(state.conversation.length, 1);
      assert.strictEqual(state.conversation[0].user_content.parts[0].text, 'Hello');
    });

    it('should set userId from session input', () => {
      const evalCase: EvalCase = {
        eval_id: 'test-123',
        conversation: [],
        session_input: { user_id: 'custom-user-id' },
      };
      const state = handleEditConversation(evalCase);
      assert.strictEqual(state.userId, 'custom-user-id');
    });

    it('should format initial state as JSON', () => {
      const evalCase: EvalCase = {
        eval_id: 'test-123',
        conversation: [],
        session_input: {
          user_id: 'user-1',
          state: { key: 'value' },
        },
      };
      const state = handleEditConversation(evalCase);
      const parsed = JSON.parse(state.initialState);
      assert.strictEqual(parsed.key, 'value');
    });
  });

  describe('validateInitialState', () => {
    const validateInitialState = (jsonString: string): { valid: boolean; error?: string } => {
      try {
        JSON.parse(jsonString);
        return { valid: true };
      } catch {
        return { valid: false, error: 'Invalid JSON in initial state' };
      }
    };

    it('should accept valid JSON', () => {
      const result = validateInitialState('{"key": "value"}');
      assert.strictEqual(result.valid, true);
    });

    it('should accept empty object', () => {
      const result = validateInitialState('{}');
      assert.strictEqual(result.valid, true);
    });

    it('should reject invalid JSON', () => {
      const result = validateInitialState('not json');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error);
    });
  });

  describe('buildEvalCase', () => {
    interface EvalCaseInput {
      agentName: string;
      conversation: ConversationTurn[];
      userId: string;
      initialState: Record<string, unknown>;
    }

    const buildEvalCase = (input: EvalCaseInput): EvalCase => {
      return {
        eval_id: `${input.agentName}-eval-${Date.now()}`,
        conversation: input.conversation,
        session_input: {
          user_id: input.userId,
          state: input.initialState,
        },
      };
    };

    it('should create eval case with correct structure', () => {
      const turn: ConversationTurn = {
        invocation_id: 'inv-1',
        user_content: { parts: [{ text: 'Test' }] },
      };
      const result = buildEvalCase({
        agentName: 'test-agent',
        conversation: [turn],
        userId: 'user-123',
        initialState: { foo: 'bar' },
      });

      assert.ok(result.eval_id.startsWith('test-agent-eval-'));
      assert.strictEqual(result.conversation.length, 1);
      assert.strictEqual(result.session_input.user_id, 'user-123');
      assert.deepStrictEqual(result.session_input.state, { foo: 'bar' });
    });
  });

  describe('updateEvalCases', () => {
    const createEvalCase = (id: string): EvalCase => ({
      eval_id: id,
      conversation: [],
      session_input: { user_id: 'user-1' },
    });

    const updateEvalCases = (
      existing: EvalCase[],
      newCase: EvalCase,
      editingId: string | null
    ): EvalCase[] => {
      if (editingId) {
        const index = existing.findIndex(ec => ec.eval_id === editingId);
        if (index >= 0) {
          const updated = [...existing];
          newCase.eval_id = editingId;
          updated[index] = newCase;
          return updated;
        }
      }
      return [...existing, newCase];
    };

    it('should add new eval case when not editing', () => {
      const existing = [createEvalCase('case-1')];
      const newCase = createEvalCase('case-2');
      const result = updateEvalCases(existing, newCase, null);
      assert.strictEqual(result.length, 2);
    });

    it('should replace existing case when editing', () => {
      const existing = [createEvalCase('case-1'), createEvalCase('case-2')];
      const updated: EvalCase = {
        eval_id: 'new-id', // Will be overwritten
        conversation: [{
          invocation_id: 'inv',
          user_content: { parts: [{ text: 'Updated' }] },
        }],
        session_input: { user_id: 'user-2' },
      };
      const result = updateEvalCases(existing, updated, 'case-1');
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].eval_id, 'case-1'); // Preserved ID
      assert.strictEqual(result[0].session_input.user_id, 'user-2');
    });

    it('should not mutate original array', () => {
      const existing = [createEvalCase('case-1')];
      const newCase = createEvalCase('case-2');
      updateEvalCases(existing, newCase, null);
      assert.strictEqual(existing.length, 1);
    });
  });

  describe('deleteEvalCase', () => {
    const createEvalCase = (id: string): EvalCase => ({
      eval_id: id,
      conversation: [],
      session_input: { user_id: 'user-1' },
    });

    const deleteEvalCase = (cases: EvalCase[], idToDelete: string): EvalCase[] => {
      return cases.filter(ec => ec.eval_id !== idToDelete);
    };

    it('should remove eval case by id', () => {
      const cases = [
        createEvalCase('case-1'),
        createEvalCase('case-2'),
        createEvalCase('case-3'),
      ];
      const result = deleteEvalCase(cases, 'case-2');
      assert.strictEqual(result.length, 2);
      assert.ok(!result.find(c => c.eval_id === 'case-2'));
    });

    it('should return same array if id not found', () => {
      const cases = [createEvalCase('case-1')];
      const result = deleteEvalCase(cases, 'non-existent');
      assert.strictEqual(result.length, 1);
    });
  });
});
