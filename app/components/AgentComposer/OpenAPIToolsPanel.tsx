'use client';

import React, { useState } from 'react';
import { Globe, Trash2, Plus, Link } from 'lucide-react';

/**
 * OpenAPI Tool configuration for agents
 * Stored in YAML as:
 * tools:
 *   - name: OpenAPIToolset
 *     args:
 *       name: petstore_api
 *       spec_url: https://petstore3.swagger.io/api/v3/openapi.json
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="add-openapi-dialog">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-4 py-3 border-b dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Add OpenAPI Tool</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Connect an external REST API via OpenAPI specification
          </p>
        </div>

        <div className="p-4 space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Tool Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="petstore_api"
              className={`w-full px-3 py-2 text-sm border rounded-md dark:bg-zinc-700 dark:text-white ${
                errors.name ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-600'
              }`}
              data-testid="openapi-name-input"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name}</p>
            )}
            <p className="mt-1 text-xs text-zinc-500">Lowercase letters, numbers, and underscores only</p>
          </div>

          {/* Spec URL Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              OpenAPI Spec URL
            </label>
            <input
              type="url"
              value={specUrl}
              onChange={(e) => setSpecUrl(e.target.value)}
              placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
              className={`w-full px-3 py-2 text-sm border rounded-md dark:bg-zinc-700 dark:text-white ${
                errors.specUrl ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-600'
              }`}
              data-testid="openapi-spec-url-input"
            />
            {errors.specUrl && (
              <p className="mt-1 text-xs text-red-500">{errors.specUrl}</p>
            )}
            <p className="mt-1 text-xs text-zinc-500">URL to JSON or YAML OpenAPI 3.x specification</p>
          </div>
        </div>

        <div className="px-4 py-3 border-t dark:border-zinc-700 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md"
            data-testid="cancel-openapi-button"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md"
            data-testid="save-openapi-button"
          >
            Add Tool
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
      className="p-3 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg border border-zinc-200 dark:border-zinc-600"
      data-testid={`openapi-card-${tool.name}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
              {tool.name}
            </p>
            <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              <Link className="w-3 h-3" />
              <span className="truncate max-w-[200px]">{tool.specUrl}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-1 text-zinc-400 hover:text-red-500 rounded"
          title="Delete"
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
        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          OpenAPI Tools
        </h4>
        <button
          onClick={() => setDialogOpen(true)}
          className="p-1 text-zinc-400 hover:text-blue-500 rounded"
          title="Add OpenAPI Tool"
          data-testid="add-openapi-button"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {openApiTools.length === 0 ? (
        <div
          className="text-center py-4 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600"
          data-testid="openapi-tools-empty-state"
        >
          <Globe className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No OpenAPI tools configured</p>
          <button
            onClick={() => setDialogOpen(true)}
            className="mt-2 text-xs text-blue-500 hover:text-blue-600"
          >
            Add your first OpenAPI tool
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

      <AddOpenAPIDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={onAddOpenApiTool}
      />
    </div>
  );
}
