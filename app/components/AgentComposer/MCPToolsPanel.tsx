'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Server, Terminal, Globe, X, RefreshCw, Trash2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

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
    connected: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', label: 'ONLINE' },
    disconnected: { icon: AlertCircle, color: 'text-muted-foreground/40', bg: 'bg-muted', label: 'OFFLINE' },
    error: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'ERROR' },
    connecting: { icon: Loader2, color: 'text-primary', bg: 'bg-primary/10', label: 'SYNC' },
  };

  const { icon: Icon, color, bg, label } = config[status];

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono border border-current opacity-80 ${bg} ${color}`}>
      <Icon size={10} className={status === 'connecting' ? 'animate-spin' : ''} />
      <span className="tracking-widest">{label}</span>
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
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono">{label}</label>
        <button
          type="button"
          onClick={() => onChange([...items, { key: '', value: '' }])}
          className="text-[10px] font-bold text-primary hover:text-primary/80 uppercase tracking-wide flex items-center gap-1 transition-colors"
        >
          <Plus size={12} /> Add Entry
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              placeholder={placeholder?.key || 'KEY'}
              className="flex-1 min-w-0 bg-background border border-border rounded-sm px-2 py-1.5 text-xs font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              value={item.key}
              onChange={(e) => {
                const newItems = [...items];
                newItems[idx].key = e.target.value;
                onChange(newItems);
              }}
            />
            <input
              placeholder={placeholder?.value || 'VALUE'}
              className="flex-1 min-w-0 bg-background border border-border rounded-sm px-2 py-1.5 text-xs font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none"
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
              className="text-muted-foreground/40 hover:text-destructive transition-colors px-1"
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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-border"
        onClick={e => e.stopPropagation()}
        data-testid="add-mcp-server-dialog"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <h2 className="text-lg font-heading font-bold text-foreground uppercase tracking-tight">Register MCP Node</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 bg-card">
          {/* Server Name */}
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 font-mono">
              Process Identifier
            </label>
            <input
              data-testid="mcp-server-name-input"
              className={`w-full bg-background border rounded-sm px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all ${
                errors.name ? 'border-destructive bg-destructive/5' : 'border-border'
              }`}
              placeholder="e.g., FILESYSTEM_CONTROLLER"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
              }}
            />
            {errors.name && <p className="text-[10px] text-destructive mt-1 uppercase font-mono tracking-tighter">{errors.name}</p>}
          </div>

          {/* Type Tabs */}
          <div className="flex bg-muted rounded-sm p-1 border border-border shadow-inner">
            <button
              type="button"
              data-testid="mcp-type-tab-stdio"
              onClick={() => setActiveTab('stdio')}
              className={`flex-1 flex items-center justify-center gap-2 text-[10px] py-2 rounded-sm font-bold uppercase tracking-widest transition-all ${
                activeTab === 'stdio'
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Terminal size={14} /> LOCAL_STDIO
            </button>
            <button
              type="button"
              data-testid="mcp-type-tab-sse"
              onClick={() => setActiveTab('sse')}
              className={`flex-1 flex items-center justify-center gap-2 text-[10px] py-2 rounded-sm font-bold uppercase tracking-widest transition-all ${
                activeTab === 'sse'
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe size={14} /> REMOTE_SSE
            </button>
          </div>

          {/* Stdio Configuration */}
          {activeTab === 'stdio' && (
            <div className="space-y-5" data-testid="mcp-stdio-config">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 font-mono">
                  Runtime Command
                </label>
                <input
                  data-testid="mcp-stdio-command-input"
                  className={`w-full font-mono bg-background border rounded-sm px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none ${
                    errors.command ? 'border-destructive bg-destructive/5' : 'border-border'
                  }`}
                  placeholder="npx, python3, etc."
                  value={command}
                  onChange={(e) => {
                    setCommand(e.target.value);
                    if (errors.command) setErrors(prev => ({ ...prev, command: undefined }));
                  }}
                />
                {errors.command && <p className="text-[10px] text-destructive mt-1 uppercase font-mono tracking-tighter">{errors.command}</p>}
              </div>

              {/* Arguments */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Process Arguments</label>
                  <button
                    type="button"
                    data-testid="mcp-stdio-add-arg-button"
                    onClick={() => setArgs([...args, ''])}
                    className="text-[10px] font-bold text-primary hover:text-primary/80 uppercase tracking-wide flex items-center gap-1 transition-colors"
                  >
                    <Plus size={12} /> Add Param
                  </button>
                </div>
                <div className="space-y-2">
                  {args.map((arg, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        data-testid={`mcp-stdio-arg-${idx}`}
                        className="flex-1 min-w-0 font-mono bg-background border border-border rounded-sm px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                        placeholder={`ARG_${idx}`}
                        value={arg}
                        onChange={(e) => {
                          const newArgs = [...args];
                          newArgs[idx] = e.target.value;
                          setArgs(newArgs);
                        }}
                      />
                      <button
                        onClick={() => setArgs(args.filter((_, i) => i !== idx))}
                        className="text-muted-foreground/40 hover:text-destructive px-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                {args.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/40 italic font-mono uppercase">NO_PARAMS_CONFIGURED</p>
                )}
              </div>

              <KeyValueEditor
                label="Environment Context"
                items={envVars}
                onChange={setEnvVars}
                placeholder={{ key: 'VAR_NAME', value: 'VALUE' }}
              />
            </div>
          )}

          {/* SSE Configuration */}
          {activeTab === 'sse' && (
            <div className="space-y-5" data-testid="mcp-sse-config">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 font-mono">
                  Endpoint Vector
                </label>
                <input
                  data-testid="mcp-sse-url-input"
                  className={`w-full font-mono bg-background border rounded-sm px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none ${
                    errors.url ? 'border-destructive bg-destructive/5' : 'border-border'
                  }`}
                  placeholder="https://node.forge.io/mcp"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (errors.url) setErrors(prev => ({ ...prev, url: undefined }));
                  }}
                />
                {errors.url && <p className="text-[10px] text-destructive mt-1 uppercase font-mono tracking-tighter">{errors.url}</p>}
              </div>

              <KeyValueEditor
                label="Protocol Headers"
                items={headers}
                onChange={setHeaders}
                placeholder={{ key: 'HEADER_KEY', value: 'HEADER_VAL' }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex justify-end gap-3 bg-muted/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="mcp-server-save-button"
            onClick={handleSave}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest bg-primary text-primary-foreground rounded-sm hover:opacity-90 transition-all shadow-lg"
          >
            Connect Node
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
      className={`bg-card border rounded-sm overflow-hidden transition-all shadow-sm ${
        expanded ? 'border-primary/50 shadow-md' : 'border-border hover:border-primary/30'
      }`}
    >
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between p-3 cursor-pointer select-none bg-card hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-1.5 rounded-sm shadow-inner ${
            server.type === 'stdio' ? 'bg-primary/10 text-primary' : 'bg-blue-500/10 text-blue-500'
          }`}>
            {server.type === 'stdio' ? <Terminal size={14} /> : <Globe size={14} />}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-foreground truncate font-heading tracking-tight">{server.name}</span>
            <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[120px] uppercase opacity-70">
              {server.type === 'stdio' ? server.command : server.url}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={server.status} />
          <div className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
            <ChevronDown size={14} className="text-muted-foreground/40" />
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-dashed border-border/50 bg-muted/10">
          {/* Actions Bar */}
          <div className="flex justify-end gap-1 py-2 mb-2 border-b border-border/10">
            <button
              onClick={(e) => { e.stopPropagation(); onRefresh(); }}
              data-testid={`mcp-server-refresh-${server.id}`}
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-sm transition-all"
              title="Reconnect Node"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              data-testid={`mcp-server-delete-${server.id}`}
              className="p-1.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-sm transition-all"
              title="Terminate Connection"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Tools List */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest mb-2 font-mono">
              Discovery {server.tools.length > 0 && `(${enabledCount}/${server.tools.length} ENABLED)`}
            </div>

            {server.status === 'connecting' && (
              <div className="py-6 flex flex-col items-center justify-center text-muted-foreground/40 font-mono">
                <Loader2 size={16} className="animate-spin mb-3 text-primary opacity-60" />
                <span className="text-[10px] uppercase tracking-tighter">Initializing_Discovery...</span>
              </div>
            )}

            {server.status === 'error' && (
              <div className="p-3 bg-destructive/5 rounded-sm border border-destructive/20 text-xs text-destructive animate-fadeIn">
                <div className="flex items-center gap-2 font-bold mb-1 uppercase tracking-tight">
                  <AlertCircle size={14} /> CONNECTION_FAILURE
                </div>
                <p className="font-mono text-[10px] opacity-80 leading-relaxed">{server.errorMessage || 'PROTOCOL_ERROR: FAILED_TO_CONNECT'}</p>
              </div>
            )}

            {server.status === 'connected' && server.tools.length === 0 && (
              <div className="py-4 text-[10px] text-muted-foreground/40 italic font-mono uppercase text-center border border-dashed border-border rounded-sm">
                NO_CAPABILITIES_DISCOVERED
              </div>
            )}

            <div className="space-y-1">
                {server.tools.map((tool) => (
                <label
                    key={tool.name}
                    data-testid={`mcp-tool-toggle-${server.id}-${tool.name}`}
                    className="flex items-start gap-3 p-2.5 rounded-sm hover:bg-accent cursor-pointer group transition-all border border-transparent hover:border-primary/10"
                >
                    <input
                    type="checkbox"
                    checked={tool.enabled}
                    onChange={() => onToggleTool(tool.name)}
                    className="mt-0.5 w-3.5 h-3.5 text-primary border-border bg-background rounded-sm focus:ring-primary"
                    />
                    <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-foreground font-mono group-hover:text-primary transition-colors">
                        {tool.name}
                    </div>
                    {tool.description && (
                        <div className="text-[10px] text-muted-foreground leading-relaxed mt-1 opacity-70">
                        {tool.description}
                        </div>
                    )}
                    </div>
                </label>
                ))}
            </div>
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
        <label className="block text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">MCP Nodes</label>
        <button
          onClick={() => setIsAddModalOpen(true)}
          data-testid="add-mcp-server-button"
          className="p-1 bg-foreground text-background rounded-sm hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
          title="Add MCP Node"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Server List */}
      <div className="space-y-2">
        {servers.length === 0 ? (
          <div
            data-testid="mcp-empty-state"
            className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-border rounded-sm bg-muted/20"
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground/40 mb-2">
              <Server size={16} />
            </div>
            <p className="text-[10px] text-muted-foreground/60 font-mono uppercase mb-2">NO_MCP_CONNECTIONS</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="text-xs font-bold text-primary hover:text-primary/80 hover:underline uppercase tracking-wide transition-colors"
            >
              Establish Uplink
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
        <div className="flex justify-between items-center text-[9px] text-muted-foreground/40 font-mono pt-1.5 border-t border-border uppercase tracking-widest">
          <span>{connectedCount}/{servers.length} NODES_ACTIVE</span>
          <span>{enabledToolsCount} CAPABILITIES</span>
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