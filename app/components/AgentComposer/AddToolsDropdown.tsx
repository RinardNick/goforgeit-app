'use client';

import { useState, useRef, useEffect } from 'react';

export type ToolType = 'builtin' | 'mcp' | 'agent' | 'openapi' | 'python';

interface AddToolsDropdownProps {
  onSelectToolType: (type: ToolType) => void;
  disabledTypes?: ToolType[]; // Types that are already visible/added
}

const TOOL_TYPES: { type: ToolType; label: string; description: string; icon: string }[] = [
  { type: 'builtin', label: 'Built-in Tools', description: 'Google Search, Code Execution, etc.', icon: '🔧' },
  { type: 'mcp', label: 'MCP Tools', description: 'Model Context Protocol servers', icon: '🔌' },
  { type: 'agent', label: 'Agent Tools', description: 'Use other agents as tools', icon: '🤖' },
  { type: 'openapi', label: 'OpenAPI Tools', description: 'REST APIs via OpenAPI spec', icon: '🌐' },
  { type: 'python', label: 'Custom Python Tools', description: 'Custom Python function tools', icon: '🐍' },
];

export function AddToolsDropdown({ onSelectToolType, disabledTypes = [] }: AddToolsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const availableTypes = TOOL_TYPES.filter(t => !disabledTypes.includes(t.type));

  if (availableTypes.length === 0) {
    return null; // All tool types are already added
  }

  return (
    <div ref={dropdownRef} className="relative" data-testid="add-tools-dropdown">
      <button
        data-testid="add-tools-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-muted/50 hover:bg-accent border border-border border-dashed rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Tools
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          data-testid="add-tools-menu"
          className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
        >
          {availableTypes.map((toolType) => (
            <button
              key={toolType.type}
              data-testid={`add-tool-type-${toolType.type}`}
              onClick={() => {
                onSelectToolType(toolType.type);
                setIsOpen(false);
              }}
              className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors border-b border-border last:border-b-0"
            >
              <span className="text-lg mt-0.5 opacity-80">{toolType.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{toolType.label}</p>
                <p className="text-xs text-muted-foreground">{toolType.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AddToolsDropdown;
