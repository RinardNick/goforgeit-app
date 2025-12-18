'use client';

import React, { useState } from 'react';
import { Globe, Trash2, Plus, Link, X } from 'lucide-react';

/**
 * OpenAPI Tool configuration for agents
 */
export interface OpenAPIToolConfig {
  id: string;
  name: string;
  specUrl: string;
}

interface OpenAPIToolsProps {
  openApiTools: OpenAPIToolConfig[];
  onAddOpenApiTool: (name: string, specUrl: string) => void;
  onDeleteOpenApiTool: (id: string) => void;
}

// Dialog for adding a new OpenAPI tool
function AddOpenAPIDialog({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, specUrl: string) => void;
}) {
  const [name, setName] = useState('');
  const [specUrl, setSpecUrl] = useState('');
  const [errors, setErrors] = useState<{ name?: string; specUrl?: string }>({});

  const handleSave = () => {
    const newErrors: { name?: string; specUrl?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      newErrors.name = 'Name must be lowercase letters, numbers, and underscores';
    }

    if (!specUrl.trim()) {
      newErrors.specUrl = 'Spec URL is required';
    } else {
      try {
        new URL(specUrl);
      } catch {
        newErrors.specUrl = 'Invalid URL format';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(name.trim(), specUrl.trim());
    setName('');
    setSpecUrl('');
    setErrors({});
    onClose();
  };

  const handleClose = () => {
    setName('');
    setSpecUrl('');
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50" data-testid="add-openapi-dialog">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-border">
        <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-heading font-bold text-foreground uppercase tracking-tight">Register OpenAPI</h3>
            <p className="text-xs text-muted-foreground font-light">
              Connect external REST interface via protocol specification
            </p>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5 bg-card">
          {/* Name Input */}
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 font-mono">
              Identifier
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., PETSTORE_API"
              className={`w-full px-3 py-2.5 text-sm bg-background border rounded-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none font-mono ${
                errors.name ? 'border-destructive' : 'border-border'
              }`}
              data-testid="openapi-name-input"
            />
            {errors.name && (
              <p className="mt-1 text-[10px] text-destructive uppercase font-mono">{errors.name}</p>
            )}
          </div>

          {/* Spec URL Input */}
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 font-mono">
              Specification Vector (URL)
            </label>
            <input
              type="url"
              value={specUrl}
              onChange={(e) => setSpecUrl(e.target.value)}
              placeholder="https://api.provider.com/v3/openapi.json"
              className={`w-full px-3 py-2.5 text-sm bg-background border rounded-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none font-mono ${
                errors.specUrl ? 'border-destructive' : 'border-border'
              }`}
              data-testid="openapi-spec-url-input"
            />
            {errors.specUrl && (
              <p className="mt-1 text-[10px] text-destructive uppercase font-mono">{errors.specUrl}</p>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-3 bg-muted/30">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            data-testid="cancel-openapi-button"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest bg-primary text-primary-foreground rounded-sm hover:opacity-90 transition-all shadow-lg"
            data-testid="save-openapi-button"
          >
            Add Capability
          </button>
        </div>
      </div>
    </div>
  );
}

// Card for displaying an OpenAPI tool
function OpenAPIToolCard({
  tool,
  onDelete,
}: {
  tool: OpenAPIToolConfig;
  onDelete: () => void;
}) {
  return (
    <div
      className="p-3 bg-primary/5 border border-primary/20 rounded-sm group hover:border-primary/40 transition-all"
      data-testid={`openapi-card-${tool.name}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-sm bg-primary/10 text-primary shadow-sm">
            <Globe className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground font-heading truncate tracking-tight uppercase">
              {tool.name}
            </p>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 font-mono mt-0.5">
              <Link className="w-3 h-3 opacity-50" />
              <span className="truncate max-w-[200px] opacity-80">{tool.specUrl}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-1.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-sm transition-colors ml-2"
          title="Remove Capability"
          data-testid="delete-openapi-button"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function OpenAPIToolsPanel({
  openApiTools,
  onAddOpenApiTool,
  onDeleteOpenApiTool,
}: OpenAPIToolsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-3" data-testid="openapi-tools-section">
      <div className="flex items-center justify-between">
        <label className="block text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">OpenAPI Tools</label>
        <button
          onClick={() => setDialogOpen(true)}
          className="p-1 bg-foreground text-background rounded-sm hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
          title="Add OpenAPI Capability"
          data-testid="add-openapi-button"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {openApiTools.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-border rounded-sm bg-muted/20"
          data-testid="openapi-tools-empty-state"
        >
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground/40 mb-2">
            <Globe size={16} />
          </div>
          <p className="text-[10px] text-muted-foreground/60 uppercase font-mono mb-2">NO_API_EXTENSIONS</p>
          <button
            onClick={() => setDialogOpen(true)}
            className="text-xs font-bold text-primary hover:text-primary/80 hover:underline uppercase tracking-wide transition-colors"
          >
            Initialize Uplink
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {openApiTools.map((tool) => (
            <OpenAPIToolCard
              key={tool.id}
              tool={tool}
              onDelete={() => onDeleteOpenApiTool(tool.id)}
            />
          ))}
        </div>
      )}

      {/* Footer Summary */}
      {openApiTools.length > 0 && (
        <div className="text-[9px] text-muted-foreground/40 font-mono pt-1.5 border-t border-border uppercase tracking-widest">
          {openApiTools.length} ENDPOINT{openApiTools.length !== 1 ? 'S' : ''}_CONNECTED
        </div>
      )}

      <AddOpenAPIDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={onAddOpenApiTool}
      />
    </div>
  );
}