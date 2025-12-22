'use client';

import React, { useState, useEffect } from 'react';
import { FileCode, Save, X } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface ToolEditorModalProps {
  isOpen: boolean;
  filename: string | null;
  initialContent: string;
  onClose: () => void;
  onSave: (filename: string, content: string) => Promise<void>;
}

export function ToolEditorModal({
  isOpen,
  filename,
  initialContent,
  onClose,
  onSave,
}: ToolEditorModalProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);

  // Update content when initialContent changes
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  if (!isOpen || !filename) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(filename, content);
      onClose();
    } catch (error) {
      console.error('Failed to save tool:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const language = filename.endsWith('.py') ? 'python' : 'yaml';

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <FileCode size={16} className="text-primary" />
            <h3 className="text-sm font-bold font-mono text-foreground">{filename}</h3>
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
              onClick={onClose}
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
            defaultLanguage={language}
            theme="vs-dark"
            value={content}
            onChange={(val) => setContent(val || '')}
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
  );
}
