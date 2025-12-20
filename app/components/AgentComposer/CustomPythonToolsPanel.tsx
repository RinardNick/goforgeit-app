'use client';

import React, { useState } from 'react';
import { PythonToolConfig } from './AgentNode';
import { FileCode, Trash2, Edit3, Save, X, Plus } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface CustomPythonToolsPanelProps {
  agentFiles: Array<{ filename: string; yaml: string }>;
  onSaveFile: (filename: string, content: string) => Promise<void>;
  onDeleteFile: (filename: string) => Promise<void>;
}

export function CustomPythonToolsPanel({
  agentFiles,
  onSaveFile,
  onDeleteFile,
}: CustomPythonToolsPanelProps) {
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Filter for python files in tools/ directory
  const pythonFiles = agentFiles.filter(f => f.filename.startsWith('tools/') && f.filename.endsWith('.py'));

  const handleStartEdit = (filename: string, content: string) => {
    setEditingFile(filename);
    setEditContent(content);
  };

  const handleCancelEdit = () => {
    setEditingFile(null);
    setEditContent('');
  };

  const handleSave = async () => {
    if (!editingFile) return;
    setIsSaving(true);
    try {
      await onSaveFile(editingFile, editContent);
      setEditingFile(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="custom-python-tools-panel">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Python Tools</label>
      </div>

      <div className="space-y-2">
        {pythonFiles.length === 0 ? (
          <div className="text-[10px] text-muted-foreground/40 italic font-mono uppercase text-center py-4 border border-dashed border-border rounded-sm">
            NO_PYTHON_TOOLS_FOUND
          </div>
        ) : (
          pythonFiles.map((file) => (
            <div key={file.filename} className="group bg-card border border-border rounded-sm overflow-hidden">
              <div className="p-2 flex items-center justify-between hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCode size={14} className="text-primary opacity-70" />
                  <span className="text-xs font-mono truncate text-foreground/80">{file.filename.replace('tools/', '')}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleStartEdit(file.filename, file.yaml)}
                    className="p-1 text-muted-foreground hover:text-primary rounded-sm transition-colors"
                    title="Edit Code"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button
                    onClick={() => onDeleteFile(file.filename)}
                    className="p-1 text-muted-foreground hover:text-destructive rounded-sm transition-colors"
                    title="Delete Tool"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Editor Modal */}
      {editingFile && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <FileCode size={16} className="text-primary" />
                <h3 className="text-sm font-bold font-mono text-foreground">{editingFile}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-all shadow-md"
                >
                  {isSaving ? <span className="animate-pulse">Saving...</span> : <><Save size={14} /> Save</>}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body - Editor */}
            <div className="flex-1 min-h-0 bg-[#1e1e1e]">
              <Editor
                height="100%"
                defaultLanguage="python"
                theme="vs-dark"
                value={editContent}
                onChange={(val) => setEditContent(val || '')}
                options={{
                  fontSize: 13,
                  fontFamily: 'var(--font-mono)',
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 16, bottom: 16 },
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}