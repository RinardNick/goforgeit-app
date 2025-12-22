import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForgeWorkspaceModal } from '../ForgeWorkspaceModal';
import { useAssistant } from '@/lib/hooks/useAssistant';

// Mock the hook
vi.mock('@/lib/hooks/useAssistant', () => ({
  useAssistant: vi.fn(),
}));

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(({ value }) => <div data-testid="monaco-editor">{value}</div>),
}));

describe('ForgeWorkspaceModal', () => {
  const mockOnSave = vi.fn();
  const mockSendMessage = vi.fn();
  const mockClearConversation = vi.fn();
  const mockSetMessages = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock scrollIntoView for jsdom
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    (useAssistant as any).mockReturnValue({
      messages: [],
      isLoading: false,
      sendMessage: mockSendMessage,
      clearConversation: mockClearConversation,
      setMessages: mockSetMessages,
    });
  });

  it('renders the welcome message on open', () => {
    render(
      <ForgeWorkspaceModal
        isOpen={true}
        onClose={() => {}}
        projectName="test-project"
        currentAgents={[]}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('The_Forge')).toBeDefined();
    // Verify welcome message effect was triggered
    expect(mockSetMessages).toHaveBeenCalled();
  });

  it('updates file list when a tool call is received', async () => {
    let toolCallHandler: any;
    
    (useAssistant as any).mockImplementation(({ onToolCall }: any) => {
      toolCallHandler = onToolCall;
      return {
        messages: [],
        isLoading: false,
        sendMessage: mockSendMessage,
        clearConversation: mockClearConversation,
        setMessages: mockSetMessages,
      };
    });

    render(
      <ForgeWorkspaceModal
        isOpen={true}
        onClose={() => {}}
        projectName="test-project"
        currentAgents={[]}
        onSave={mockOnSave}
      />
    );

    // Simulate a write_files tool call
    await act(async () => {
      toolCallHandler('write_files', {
        files: [
          { path: 'tools/test_tool.py', content: 'print("hello")' }
        ]
      }, false);
    });

    // Check if file tab appears
    expect(screen.getByText('test_tool.py')).toBeDefined();
    // Check if content is in editor
    expect(screen.getByText('print("hello")')).toBeDefined();
  });
});
