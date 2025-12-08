'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Server, Terminal, Globe, X, RefreshCw, Trash2, Settings2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

// --- Types ---
export type ServerType = 'stdio' | 'sse';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

export interface MCPTool {
  name: string;
  description: string;
  enabled: boolean;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  type: ServerType;
  // Stdio params
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // SSE params
  url?: string;
  headers?: Record<string, string>;
  // Runtime state
  status: ConnectionStatus;
  errorMessage?: string;
  tools: MCPTool[];
}

// --- Props ---
interface MCPToolsPanelProps {
  servers: MCPServerConfig[];
  onAddServer: (config: Omit<MCPServerConfig, 'id' | 'status' | 'tools'>) => void;
  onDeleteServer: (id: string) => void;
  onToggleTool: (serverId: string, toolName: string) => void;
  onRefreshServer: (serverId: string) => void;
  onUpdateServer?: (id: string, config: Partial<MCPServerConfig>) => void;
}

// --- Status Badge ---
const StatusBadge = ({ status }: { status: ConnectionStatus }) => {
  const config = {
    connected: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Connected' },
    disconnected: { icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-100', label: 'Disconnected' },
    error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Error' },
    connecting: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Connecting' },
  };

  const { icon: Icon, color, bg, label } = config[status];

  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${bg} ${color}`}>
      <Icon size={10} className={status === 'connecting' ? 'animate-spin' : ''} />
      <span className="uppercase tracking-wide">{label}</span>
    </div>
  );
};

// --- Key-Value Editor ---
interface KeyValueEditorProps {
  label: string;
  items: { key: string; value: string }[];
  onChange: (items: { key: string; value: string }[]) => void;
  placeholder?: { key: string; value: string };
}

const KeyValueEditor = ({ label, items, onChange, placeholder }: KeyValueEditorProps) => {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
        <button
          type="button"
          onClick={() => onChange([...items, { key: '', value: '' }])}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <Plus size={12} /> Add
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              placeholder={placeholder?.key || 'Key'}
              className="flex-1 min-w-0 bg-white border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={item.key}
              onChange={(e) => {
                const newItems = [...items];
                newItems[idx].key = e.target.value;
                onChange(newItems);
              }}
            />
            <input
              placeholder={placeholder?.value || 'Value'}
              className="flex-1 min-w-0 bg-white border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={item.value}
              onChange={(e) => {
                const newItems = [...items];
                newItems[idx].value = e.target.value;
                onChange(newItems);
              }}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="text-gray-400 hover:text-red-500 transition-colors px-1"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Add Server Dialog ---
interface AddServerDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: Omit<MCPServerConfig, 'id' | 'status' | 'tools'>) => void;
}

const AddServerDialog = ({ open, onClose, onSave }: AddServerDialogProps) => {
  const [activeTab, setActiveTab] = useState<ServerType>('stdio');
  const [name, setName] = useState('');

  // Stdio State
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState<string[]>([]);
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);

  // SSE State
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);

  // Validation
  const [errors, setErrors] = useState<{ name?: string; command?: string; url?: string }>({});

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = 'Server name is required';
    if (activeTab === 'stdio' && !command.trim()) newErrors.command = 'Command is required';
    if (activeTab === 'sse' && !url.trim()) newErrors.url = 'URL is required';
    if (activeTab === 'sse' && url && !url.startsWith('http')) newErrors.url = 'URL must start with http:// or https://';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const env = envVars.reduce((acc, curr) => {
      if (curr.key.trim()) acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    const headerObj = headers.reduce((acc, curr) => {
      if (curr.key.trim()) acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    onSave({
      name: name.trim(),
      type: activeTab,
      command: activeTab === 'stdio' ? command : undefined,
      args: activeTab === 'stdio' ? args.filter(a => a.trim() !== '') : undefined,
      env: activeTab === 'stdio' && Object.keys(env).length > 0 ? env : undefined,
      url: activeTab === 'sse' ? url : undefined,
      headers: activeTab === 'sse' && Object.keys(headerObj).length > 0 ? headerObj : undefined,
    });

    // Reset form
    setName('');
    setCommand('');
    setArgs([]);
    setEnvVars([]);
    setUrl('');
    setHeaders([]);
    setErrors({});
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
        data-testid="add-mcp-server-dialog"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add MCP Server</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Server Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Server Name
            </label>
            <input
              data-testid="mcp-server-name-input"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
              placeholder="e.g., Filesystem Tools"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
              }}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Type Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              data-testid="mcp-type-tab-stdio"
              onClick={() => setActiveTab('stdio')}
              className={`flex-1 flex items-center justify-center gap-2 text-sm py-2 rounded-md font-medium transition-all ${
                activeTab === 'stdio'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Terminal size={14} /> Local (Stdio)
            </button>
            <button
              type="button"
              data-testid="mcp-type-tab-sse"
              onClick={() => setActiveTab('sse')}
              className={`flex-1 flex items-center justify-center gap-2 text-sm py-2 rounded-md font-medium transition-all ${
                activeTab === 'sse'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Globe size={14} /> Remote (SSE)
            </button>
          </div>

          {/* Stdio Configuration */}
          {activeTab === 'stdio' && (
            <div className="space-y-4" data-testid="mcp-stdio-config">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Command
                </label>
                <input
                  data-testid="mcp-stdio-command-input"
                  className={`w-full font-mono border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                    errors.command ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="npx, python, node, etc."
                  value={command}
                  onChange={(e) => {
                    setCommand(e.target.value);
                    if (errors.command) setErrors(prev => ({ ...prev, command: undefined }));
                  }}
                />
                {errors.command && <p className="text-xs text-red-500 mt-1">{errors.command}</p>}
              </div>

              {/* Arguments */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Arguments</label>
                  <button
                    type="button"
                    data-testid="mcp-stdio-add-arg-button"
                    onClick={() => setArgs([...args, ''])}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
                {args.map((arg, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      data-testid={`mcp-stdio-arg-${idx}`}
                      className="flex-1 min-w-0 font-mono border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                      placeholder={`Argument ${idx + 1}`}
                      value={arg}
                      onChange={(e) => {
                        const newArgs = [...args];
                        newArgs[idx] = e.target.value;
                        setArgs(newArgs);
                      }}
                    />
                    <button
                      onClick={() => setArgs(args.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {args.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No arguments configured</p>
                )}
              </div>

              <KeyValueEditor
                label="Environment Variables"
                items={envVars}
                onChange={setEnvVars}
                placeholder={{ key: 'Variable name', value: 'Value' }}
              />
            </div>
          )}

          {/* SSE Configuration */}
          {activeTab === 'sse' && (
            <div className="space-y-4" data-testid="mcp-sse-config">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Endpoint URL
                </label>
                <input
                  data-testid="mcp-sse-url-input"
                  className={`w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                    errors.url ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="http://localhost:3000/mcp"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (errors.url) setErrors(prev => ({ ...prev, url: undefined }));
                  }}
                />
                {errors.url && <p className="text-xs text-red-500 mt-1">{errors.url}</p>}
              </div>

              <KeyValueEditor
                label="Headers"
                items={headers}
                onChange={setHeaders}
                placeholder={{ key: 'Header name', value: 'Header value' }}
              />
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
            Cancel
          </button>
          <button
            type="button"
            data-testid="mcp-server-save-button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Connect Server
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Server Card ---
interface ServerCardProps {
  server: MCPServerConfig;
  onToggleTool: (toolName: string) => void;
  onDelete: () => void;
  onRefresh: () => void;
}

const ServerCard = ({ server, onToggleTool, onDelete, onRefresh }: ServerCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const enabledCount = server.tools.filter(t => t.enabled).length;

  return (
    <div
      data-testid={`mcp-server-card-${server.id}`}
      className={`bg-white border rounded-lg overflow-hidden transition-all ${
        expanded ? 'border-blue-200 shadow-sm' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between p-3 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-1.5 rounded-md ${
            server.type === 'stdio' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
          }`}>
            {server.type === 'stdio' ? <Terminal size={14} /> : <Globe size={14} />}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-gray-900 truncate">{server.name}</span>
            <span className="text-[10px] text-gray-400 font-mono truncate max-w-[120px]">
              {server.type === 'stdio' ? server.command : server.url}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={server.status} />
          {expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-dashed border-gray-100">
          {/* Actions Bar */}
          <div className="flex justify-end gap-1 py-2 mb-2">
            <button
              onClick={(e) => { e.stopPropagation(); onRefresh(); }}
              data-testid={`mcp-server-refresh-${server.id}`}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="Reconnect & Refresh Tools"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              data-testid={`mcp-server-delete-${server.id}`}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
              title="Remove Server"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Tools List */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Available Tools {server.tools.length > 0 && `(${enabledCount}/${server.tools.length} enabled)`}
            </div>

            {server.status === 'connecting' && (
              <div className="py-4 flex flex-col items-center justify-center text-gray-400">
                <Loader2 size={16} className="animate-spin mb-2" />
                <span className="text-xs">Discovering tools...</span>
              </div>
            )}

            {server.status === 'error' && (
              <div className="p-2 bg-red-50 rounded border border-red-100 text-xs text-red-600">
                <div className="flex items-center gap-1.5 font-medium mb-1">
                  <AlertCircle size={12} /> Connection Error
                </div>
                <p className="text-red-500">{server.errorMessage || 'Failed to connect to server'}</p>
              </div>
            )}

            {server.status === 'connected' && server.tools.length === 0 && (
              <div className="py-4 text-xs text-gray-400 italic text-center">
                No tools discovered from this server
              </div>
            )}

            {server.tools.map((tool) => (
              <label
                key={tool.name}
                data-testid={`mcp-tool-toggle-${server.id}-${tool.name}`}
                className="flex items-start gap-2.5 p-2 rounded-md hover:bg-gray-50 cursor-pointer group transition-colors"
              >
                <input
                  type="checkbox"
                  checked={tool.enabled}
                  onChange={() => onToggleTool(tool.name)}
                  className="mt-0.5 w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
                    {tool.name}
                  </div>
                  {tool.description && (
                    <div className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">
                      {tool.description}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main Panel ---
export default function MCPToolsPanel({
  servers,
  onAddServer,
  onDeleteServer,
  onToggleTool,
  onRefreshServer,
}: MCPToolsPanelProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const connectedCount = servers.filter(s => s.status === 'connected').length;
  const enabledToolsCount = servers.reduce(
    (acc, s) => acc + s.tools.filter(t => t.enabled).length,
    0
  );

  return (
    <div data-testid="mcp-tools-section" className="space-y-3">
      {/* Header */}
      <div className="flex justify-between items-center">
        <label className="block text-sm font-medium text-gray-700">MCP Tools</label>
        <button
          onClick={() => setIsAddModalOpen(true)}
          data-testid="add-mcp-server-button"
          className="p-1 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
          title="Add MCP Server"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Server List */}
      <div className="space-y-2">
        {servers.length === 0 ? (
          <div
            data-testid="mcp-empty-state"
            className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/50"
          >
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-2">
              <Server size={16} />
            </div>
            <p className="text-xs text-gray-500 mb-2">No MCP servers configured</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Add your first server
            </button>
          </div>
        ) : (
          servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              onToggleTool={(toolName) => onToggleTool(server.id, toolName)}
              onDelete={() => onDeleteServer(server.id)}
              onRefresh={() => onRefreshServer(server.id)}
            />
          ))
        )}
      </div>

      {/* Footer Summary */}
      {servers.length > 0 && (
        <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono pt-1 border-t border-gray-100">
          <span>{connectedCount} server{connectedCount !== 1 ? 's' : ''} connected</span>
          <span>{enabledToolsCount} tool{enabledToolsCount !== 1 ? 's' : ''} enabled</span>
        </div>
      )}

      {/* Add Server Dialog */}
      <AddServerDialog
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={onAddServer}
      />
    </div>
  );
}
