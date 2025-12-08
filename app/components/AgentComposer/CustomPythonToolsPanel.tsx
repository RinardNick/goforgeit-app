'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Code, Trash2, Play, X, FileCode } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// Types
export interface PythonToolConfig {
  id: string;
  name: string;
  filename: string;
  code?: string;
  signature?: {
    name: string;
    params: Array<{
      name: string;
      type: string;
      required: boolean;
      default?: string;
    }>;
    docstring?: string;
    returnType?: string;
  };
  enabled: boolean;
}

interface CustomPythonToolsPanelProps {
  projectName: string;
  pythonTools: PythonToolConfig[];
  onToolsChange: (tools: PythonToolConfig[]) => void;
  onCreateTool: (name: string, code: string) => Promise<PythonToolConfig | null>;
  onDeleteTool: (id: string) => Promise<boolean>;
  onTestTool?: (toolName: string, params: Record<string, unknown>) => Promise<{ success: boolean; result?: unknown; error?: string }>;
}

// Default Python tool template
const DEFAULT_TOOL_TEMPLATE = `def my_tool(query: str, count: int = 5) -> dict:
    """Describe what this tool does.

    Args:
        query: The search query to process
        count: Number of results to return (optional)

    Returns:
        A dictionary with status and results
    """
    # Your implementation here
    return {
        "status": "success",
        "results": [f"Result for {query}"] * count
    }
`;

// Create Tool Dialog Component
function CreateToolDialog({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, code: string) => void;
}) {
  const [toolName, setToolName] = useState('');
  const [code, setCode] = useState(DEFAULT_TOOL_TEMPLATE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setToolName('');
      setCode(DEFAULT_TOOL_TEMPLATE);
      setError(null);
    }
  }, [isOpen]);

  const handleCreate = () => {
    // Validate tool name
    if (!toolName.trim()) {
      setError('Tool name is required');
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(toolName)) {
      setError('Tool name must be lowercase with underscores (e.g., my_tool)');
      return;
    }
    if (!code.includes('def ')) {
      setError('Code must contain a function definition');
      return;
    }
    if (!code.includes('"""')) {
      setError('Function must have a docstring');
      return;
    }

    onCreate(toolName, code);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        data-testid="create-python-tool-dialog"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileCode size={20} className="text-green-600" />
            Create Python Tool
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Tool Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Tool Name
            </label>
            <input
              type="text"
              value={toolName}
              onChange={(e) => setToolName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="my_custom_tool"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
              data-testid="python-tool-name-input"
            />
            <p className="text-xs text-gray-400 mt-1">
              Use lowercase letters, numbers, and underscores
            </p>
          </div>

          {/* Python Code Editor */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Python Code
            </label>
            <div
              className="border border-gray-200 rounded-lg overflow-hidden"
              data-testid="python-code-editor"
            >
              <MonacoEditor
                height="300px"
                language="python"
                value={code}
                onChange={(value) => setCode(value || '')}
                theme="vs-light"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 4,
                  wordWrap: 'on',
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Define a function with type hints and a docstring. The docstring becomes the tool description.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            data-testid="create-python-tool-button"
            className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            Create Tool
          </button>
        </div>
      </div>
    </div>
  );
}

// Test Tool Dialog Component
function TestToolDialog({
  isOpen,
  onClose,
  tool,
  onRunTest,
}: {
  isOpen: boolean;
  onClose: () => void;
  tool: PythonToolConfig | null;
  onRunTest: (params: Record<string, unknown>) => Promise<{ success: boolean; result?: unknown; error?: string }>;
}) {
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ success: boolean; result?: unknown; error?: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (isOpen && tool?.signature?.params) {
      const initialParams: Record<string, string> = {};
      tool.signature.params.forEach((p) => {
        initialParams[p.name] = p.default || '';
      });
      setParams(initialParams);
      setResult(null);
    }
  }, [isOpen, tool]);

  const handleRun = async () => {
    setIsRunning(true);
    try {
      // Convert params to appropriate types based on signature
      const typedParams: Record<string, unknown> = {};
      tool?.signature?.params.forEach((p) => {
        const value = params[p.name];
        if (p.type === 'int') {
          typedParams[p.name] = parseInt(value) || 0;
        } else if (p.type === 'float') {
          typedParams[p.name] = parseFloat(value) || 0;
        } else if (p.type === 'bool') {
          typedParams[p.name] = value.toLowerCase() === 'true';
        } else {
          typedParams[p.name] = value;
        }
      });

      const testResult = await onRunTest(typedParams);
      setResult(testResult);
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setIsRunning(false);
    }
  };

  if (!isOpen || !tool) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="test-python-tool-dialog"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Play size={20} className="text-blue-600" />
            Test: {tool.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Description */}
          {tool.signature?.docstring && (
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              {tool.signature.docstring}
            </p>
          )}

          {/* Parameter Inputs */}
          {tool.signature?.params.map((param) => (
            <div key={param.name}>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                {param.name} ({param.type}){!param.required && ' - optional'}
              </label>
              <input
                type="text"
                value={params[param.name] || ''}
                onChange={(e) => setParams({ ...params, [param.name]: e.target.value })}
                placeholder={param.default ? `Default: ${param.default}` : `Enter ${param.name}`}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                data-testid={`test-param-${param.name}`}
              />
            </div>
          ))}

          {/* Result Display */}
          {result && (
            <div
              className={`p-3 rounded-lg text-sm ${
                result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}
              data-testid="tool-test-result"
            >
              <p className={`font-medium mb-1 ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                {result.success ? 'Success' : 'Error'}
              </p>
              <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-40">
                {result.success ? JSON.stringify(result.result, null, 2) : result.error}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            data-testid="run-tool-test-button"
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Play size={16} />
            {isRunning ? 'Running...' : 'Run Test'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Python Tool Card Component
function PythonToolCard({
  tool,
  onToggle,
  onDelete,
  onTest,
}: {
  tool: PythonToolConfig;
  onToggle: () => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  return (
    <div
      data-testid={`python-tool-card-${tool.name}`}
      className={`border rounded-lg p-3 transition-colors ${
        tool.enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {/* Enable Checkbox */}
          <input
            type="checkbox"
            checked={tool.enabled}
            onChange={onToggle}
            className="mt-1 w-4 h-4 text-green-600 rounded focus:ring-green-500"
            data-testid="enable-python-tool-checkbox"
          />

          <div className="min-w-0 flex-1">
            {/* Tool Name */}
            <div className="flex items-center gap-2">
              <Code size={14} className="text-green-600 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-900 truncate">{tool.name}</span>
            </div>

            {/* Function Signature */}
            {tool.signature && (
              <p className="text-xs text-gray-500 font-mono mt-1 truncate">
                ({tool.signature.params.map((p) => `${p.name}: ${p.type}`).join(', ')})
              </p>
            )}

            {/* Docstring Preview */}
            {tool.signature?.docstring && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                {tool.signature.docstring}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onTest}
            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
            title="Test tool"
            data-testid="test-python-tool-button"
          >
            <Play size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            title="Delete tool"
            data-testid="delete-python-tool-button"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Panel Component
export default function CustomPythonToolsPanel({
  projectName,
  pythonTools,
  onToolsChange,
  onCreateTool,
  onDeleteTool,
  onTestTool,
}: CustomPythonToolsPanelProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [testingTool, setTestingTool] = useState<PythonToolConfig | null>(null);

  const handleCreate = async (name: string, code: string) => {
    const newTool = await onCreateTool(name, code);
    if (newTool) {
      onToolsChange([...pythonTools, newTool]);
    }
  };

  const handleDelete = async (id: string) => {
    const success = await onDeleteTool(id);
    if (success) {
      onToolsChange(pythonTools.filter((t) => t.id !== id));
    }
  };

  const handleToggle = (id: string) => {
    onToolsChange(
      pythonTools.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const handleTest = useCallback(async (params: Record<string, unknown>) => {
    if (!testingTool || !onTestTool) {
      return { success: false, error: 'Test not available' };
    }
    return onTestTool(testingTool.name, params);
  }, [testingTool, onTestTool]);

  return (
    <div data-testid="custom-python-tools-section" className="space-y-3">
      {/* Header */}
      <div className="flex justify-between items-center">
        <label className="block text-sm font-medium text-gray-700">Custom Python Tools</label>
        <button
          onClick={() => setIsCreateDialogOpen(true)}
          data-testid="add-python-tool-btn"
          className="p-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          title="Create Python Tool"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Tools List */}
      <div className="space-y-2">
        {pythonTools.length === 0 ? (
          <div
            data-testid="custom-python-tools-empty-state"
            className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/50"
          >
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-2">
              <Code size={16} />
            </div>
            <p className="text-xs text-gray-500 mb-2">No custom Python tools</p>
            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="text-xs font-medium text-green-600 hover:text-green-700 hover:underline"
            >
              Create your first Python tool
            </button>
          </div>
        ) : (
          pythonTools.map((tool) => (
            <PythonToolCard
              key={tool.id}
              tool={tool}
              onToggle={() => handleToggle(tool.id)}
              onDelete={() => handleDelete(tool.id)}
              onTest={() => setTestingTool(tool)}
            />
          ))
        )}
      </div>

      {/* Footer Summary */}
      {pythonTools.length > 0 && (
        <div className="text-[10px] text-gray-400 font-mono pt-1 border-t border-gray-100">
          {pythonTools.filter((t) => t.enabled).length}/{pythonTools.length} tool
          {pythonTools.length !== 1 ? 's' : ''} enabled
        </div>
      )}

      {/* Create Dialog */}
      <CreateToolDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={handleCreate}
      />

      {/* Test Dialog */}
      <TestToolDialog
        isOpen={testingTool !== null}
        onClose={() => setTestingTool(null)}
        tool={testingTool}
        onRunTest={handleTest}
      />
    </div>
  );
}
