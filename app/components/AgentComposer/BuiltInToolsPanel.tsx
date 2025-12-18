'use client';

import { useState } from 'react';
import { ToolConfig } from './AgentNode';

// Built-in tools categorized
const BUILTIN_TOOLS = {
  search: [
    { id: 'google_search', name: 'google_search', description: 'Web search using Google', icon: '🔍' },
    { id: 'EnterpriseWebSearchTool', name: 'EnterpriseWebSearchTool', description: 'Enterprise web search', icon: '🏢' },
    { id: 'VertexAiSearchTool', name: 'VertexAiSearchTool', description: 'Vertex AI search datastore', icon: '☁️' },
  ],
  context: [
    { id: 'built_in_code_execution', name: 'built_in_code_execution', description: 'Python code execution', icon: '🐍' },
    { id: 'FilesRetrieval', name: 'FilesRetrieval', description: 'Retrieve uploaded files', icon: '📁' },
    { id: 'load_memory', name: 'load_memory', description: 'Load agent memory', icon: '🧠' },
    { id: 'preload_memory', name: 'preload_memory', description: 'Preload memory context', icon: '💾' },
    { id: 'url_context', name: 'url_context', description: 'Fetch URL content', icon: '🌐' },
    { id: 'VertexAiRagRetrieval', name: 'VertexAiRagRetrieval', description: 'RAG retrieval from Vertex', icon: '📊' },
  ],
  agent: [
    { id: 'exit_loop', name: 'exit_loop', description: 'Exit from LoopAgent', icon: '🚪' },
    { id: 'get_user_choice', name: 'get_user_choice', description: 'Prompt user for choice', icon: '❓' },
    { id: 'load_artifacts', name: 'load_artifacts', description: 'Load session artifacts', icon: '📦' },
    { id: 'LongRunningFunctionTool', name: 'LongRunningFunctionTool', description: 'Async long-running tasks', icon: '⏳' },
    { id: 'transfer_to_agent', name: 'transfer_to_agent', description: 'Transfer to agent', icon: '🔀' },
    { id: 'escalate', name: 'escalate', description: 'Escalate to parent', icon: '⬆️' },
  ],
};

// Flatten for easy lookup
const ALL_BUILTIN_TOOLS = [...BUILTIN_TOOLS.search, ...BUILTIN_TOOLS.context, ...BUILTIN_TOOLS.agent];

interface BuiltInToolsPanelProps {
  selectedTools: string[];
  toolConfigs: Map<string, ToolConfig>; // Tool ID -> configuration
  onToolsChange: (tools: string[]) => void;
  onToolConfigChange: (toolId: string, config: ToolConfig) => void;
}

/**
 * Add Built-in Tool Modal - Multiselect dialog for adding built-in tools
 */
function AddBuiltInToolModal({
  isOpen,
  onClose,
  selectedTools,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedTools: string[];
  onConfirm: (newTools: string[]) => void;
}) {
  const [tempSelected, setTempSelected] = useState<string[]>(selectedTools);

  if (!isOpen) return null;

  const toggleTool = (toolId: string) => {
    if (tempSelected.includes(toolId)) {
      setTempSelected(tempSelected.filter(t => t !== toolId));
    } else {
      setTempSelected([...tempSelected, toolId]);
    }
  };

  const handleConfirm = () => {
    onConfirm(tempSelected);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        data-testid="builtin-tools-modal"
        className="bg-card rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden border border-border"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <h3 className="text-lg font-heading font-bold text-foreground">Add Built-in Tools</h3>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body - Tool Categories */}
        <div className="px-5 py-4 overflow-y-auto max-h-[50vh] space-y-4 bg-card">
          {/* Search Tools */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 font-mono">Search Tools</p>
            <div className="space-y-1">
              {BUILTIN_TOOLS.search.map(tool => (
                <label
                  key={tool.id}
                  data-testid={`modal-tool-${tool.id}`}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    tempSelected.includes(tool.id)
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-accent border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={tempSelected.includes(tool.id)}
                    onChange={() => toggleTool(tool.id)}
                    className="w-4 h-4 text-primary rounded focus:ring-primary bg-card border-muted-foreground"
                  />
                  <span className="text-lg opacity-80">{tool.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{tool.name}</p>
                    <p className="text-xs text-muted-foreground">{tool.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Context Tools */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 font-mono">Context Tools</p>
            <div className="space-y-1">
              {BUILTIN_TOOLS.context.map(tool => (
                <label
                  key={tool.id}
                  data-testid={`modal-tool-${tool.id}`}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    tempSelected.includes(tool.id)
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-accent border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={tempSelected.includes(tool.id)}
                    onChange={() => toggleTool(tool.id)}
                    className="w-4 h-4 text-primary rounded focus:ring-primary bg-card border-muted-foreground"
                  />
                  <span className="text-lg opacity-80">{tool.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{tool.name}</p>
                    <p className="text-xs text-muted-foreground">{tool.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Agent Function Tools */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 font-mono">Agent Function Tools</p>
            <div className="space-y-1">
              {BUILTIN_TOOLS.agent.map(tool => (
                <label
                  key={tool.id}
                  data-testid={`modal-tool-${tool.id}`}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    tempSelected.includes(tool.id)
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-accent border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={tempSelected.includes(tool.id)}
                    onChange={() => toggleTool(tool.id)}
                    className="w-4 h-4 text-primary rounded focus:ring-primary bg-card border-muted-foreground"
                  />
                  <span className="text-lg opacity-80">{tool.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{tool.name}</p>
                    <p className="text-xs text-muted-foreground">{tool.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-between bg-muted/30">
          <p className="text-sm text-muted-foreground font-mono">
            {tempSelected.length} tool{tempSelected.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="confirm-builtin-tools"
              onClick={handleConfirm}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * BuiltInToolsPanel - Compact panel for managing built-in tools
 * Shows added tools as expandable cards with confirmation configuration
 */
export function BuiltInToolsPanel({ selectedTools, toolConfigs, onToolsChange, onToolConfigChange }: BuiltInToolsPanelProps) {
  const [showModal, setShowModal] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const removeTool = (toolId: string) => {
    onToolsChange(selectedTools.filter(t => t !== toolId));
  };

  const getToolInfo = (toolId: string) => {
    return ALL_BUILTIN_TOOLS.find(t => t.id === toolId) || { id: toolId, name: toolId, icon: '🔧', description: '' };
  };

  const toggleExpanded = (toolId: string) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(toolId)) {
      newExpanded.delete(toolId);
    } else {
      newExpanded.add(toolId);
    }
    setExpandedTools(newExpanded);
  };

  const updateToolConfig = (toolId: string, updates: Partial<ToolConfig>) => {
    const existing = toolConfigs.get(toolId) || { id: toolId };
    const merged = { ...existing, ...updates };
    onToolConfigChange(toolId, merged);
  };

  return (
    <div data-testid="builtin-tools-section">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Built-in Tools</label>
        <button
          data-testid="add-builtin-tool-btn"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-primary hover:text-primary-foreground hover:bg-primary rounded transition-colors uppercase tracking-wide border border-primary/20"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {/* Selected Tools as Expandable Cards */}
      {selectedTools.length > 0 ? (
        <div className="space-y-2">
          {selectedTools.map(toolId => {
            const tool = getToolInfo(toolId);
            const config = toolConfigs.get(toolId) || { id: toolId };
            const isExpanded = expandedTools.has(toolId);
            const hasConfirmation = config.requireConfirmation;

            return (
              <div
                key={toolId}
                data-testid={`tool-card-${toolId}`}
                className="border border-border rounded-sm overflow-hidden bg-card transition-all hover:border-primary/30"
              >
                {/* Tool Header - Clickable to expand/collapse */}
                <div
                  className="flex items-center gap-2 p-2 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => toggleExpanded(toolId)}
                >
                  <span className="text-base opacity-80">{tool.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-medium text-foreground">{tool.name}</p>
                    {tool.description && (
                      <p className="text-[10px] text-muted-foreground truncate">{tool.description}</p>
                    )}
                  </div>

                  {/* Visual indicator for confirmation requirement */}
                  {hasConfirmation && (
                    <span
                      data-testid="tool-confirmation-indicator"
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 rounded-sm"
                      title="Requires confirmation"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Confirm
                    </span>
                  )}

                  {/* Expand/Collapse icon */}
                  <svg
                    className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>

                  {/* Remove button */}
                  <button
                    data-testid={`remove-tool-${toolId}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTool(toolId);
                    }}
                    className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                    title="Remove tool"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Expanded Configuration Panel */}
                {isExpanded && (
                  <div className="px-3 py-3 border-t border-border bg-muted/20 space-y-3">
                    {/* Require Confirmation Toggle */}
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        data-testid="tool-require-confirmation-toggle"
                        checked={config.requireConfirmation || false}
                        onChange={(e) => {
                          updateToolConfig(toolId, {
                            requireConfirmation: e.target.checked,
                            confirmationPrompt: e.target.checked ? (config.confirmationPrompt || '') : undefined,
                          });
                        }}
                        className="mt-0.5 w-4 h-4 text-primary rounded focus:ring-primary bg-card border-muted-foreground"
                      />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">Require Confirmation</p>
                        <p className="text-[10px] text-muted-foreground">Ask user to confirm before executing this tool</p>
                      </div>
                    </label>

                    {/* Confirmation Prompt Input (shown when confirmation is enabled) */}
                    {config.requireConfirmation && (
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                          Confirmation Prompt
                        </label>
                        <input
                          type="text"
                          data-testid="tool-confirmation-prompt-input"
                          value={config.confirmationPrompt || ''}
                          onChange={(e) => updateToolConfig(toolId, { confirmationPrompt: e.target.value })}
                          placeholder="e.g., Are you sure you want to search the web?"
                          className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                        />
                        <p className="mt-1 text-[10px] text-muted-foreground/60">
                          Custom message shown to the user when confirmation is required
                        </p>
                      </div>
                    )}

                    {/* VertexAiSearchTool-specific: data_store_id configuration */}
                    {toolId === 'VertexAiSearchTool' && (
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                          Data Store ID <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="text"
                          data-testid="vertex-data-store-id-input"
                          value={config.dataStoreId || ''}
                          onChange={(e) => updateToolConfig(toolId, { dataStoreId: e.target.value })}
                          placeholder="projects/PROJECT_ID/locations/global/collections/default_collection/dataStores/DATASTORE_ID"
                          className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                        />
                        <p className="mt-1 text-[10px] text-muted-foreground/60">
                          Full resource path to your Vertex AI Search datastore
                        </p>
                      </div>
                    )}

                    {/* VertexAiRagRetrieval-specific configuration */}
                    {toolId === 'VertexAiRagRetrieval' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                            RAG Corpora <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="text"
                            data-testid="rag-corpora-input"
                            value={config.ragCorpora || ''}
                            onChange={(e) => updateToolConfig(toolId, { ragCorpora: e.target.value })}
                            placeholder="projects/PROJECT_ID/locations/LOCATION/ragCorpora/CORPUS_ID"
                            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                          />
                          <p className="mt-1 text-[10px] text-muted-foreground/60">
                            Full resource path to your Vertex AI RAG corpus
                          </p>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                            Similarity Top K
                          </label>
                          <input
                            type="number"
                            data-testid="similarity-top-k-input"
                            value={config.similarityTopK ?? ''}
                            onChange={(e) => updateToolConfig(toolId, { similarityTopK: e.target.value ? parseInt(e.target.value) : undefined })}
                            placeholder="10"
                            min="1"
                            max="100"
                            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                          />
                          <p className="mt-1 text-[10px] text-muted-foreground/60">
                            Number of top results to return (default: 10)
                          </p>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                            Vector Distance Threshold
                          </label>
                          <input
                            type="number"
                            data-testid="vector-distance-threshold-input"
                            value={config.vectorDistanceThreshold ?? ''}
                            onChange={(e) => updateToolConfig(toolId, { vectorDistanceThreshold: e.target.value ? parseFloat(e.target.value) : undefined })}
                            placeholder="0.5"
                            min="0"
                            max="1"
                            step="0.1"
                            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                          />
                          <p className="mt-1 text-[10px] text-muted-foreground/60">
                            Similarity threshold (0-1, lower is more similar)
                          </p>
                        </div>
                      </div>
                    )}

                    {/* FilesRetrieval-specific configuration */}
                    {toolId === 'FilesRetrieval' && (
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                          Input Directory <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="text"
                          data-testid="files-input-dir-input"
                          value={config.inputDir || ''}
                          onChange={(e) => updateToolConfig(toolId, { inputDir: e.target.value })}
                          placeholder="./data/documents"
                          className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                        />
                        <p className="mt-1 text-[10px] text-muted-foreground/60">
                          Path to the directory containing files to retrieve from
                        </p>
                      </div>
                    )}

                    {/* LongRunningFunctionTool-specific configuration */}
                    {toolId === 'LongRunningFunctionTool' && (
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                          Function Path <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="text"
                          data-testid="long-running-func-input"
                          value={config.funcPath || ''}
                          onChange={(e) => updateToolConfig(toolId, { funcPath: e.target.value })}
                          placeholder="my_module.long_running_task"
                          className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                        />
                        <p className="mt-1 text-[10px] text-muted-foreground/60">
                          Python function path (module.function_name) for the async task
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/40 italic">No built-in tools added</p>
      )}

      {/* Modal */}
      <AddBuiltInToolModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        selectedTools={selectedTools}
        onConfirm={onToolsChange}
      />
    </div>
  );
}

export default BuiltInToolsPanel;
