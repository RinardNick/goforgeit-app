'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Wrench, 
  Sparkles, 
  X, 
  MessageSquare, 
  FileCode, 
  Save, 
  ArrowLeft,
  ChevronRight,
  Terminal,
  Loader2
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAssistant, Message } from '@/lib/hooks/useAssistant';
import { LoadingButton } from '@/components/ui/LoadingButton';

interface ForgeWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  currentAgents: Array<{ filename: string; name: string; agentClass: string }>;
  initialDescription?: string;
  onSave: (files: Array<{ filename: string; content: string }>) => Promise<void>;
}

export function ForgeWorkspaceModal({
  isOpen,
  onClose,
  projectName,
  currentAgents,
  initialDescription = '',
  onSave,
}: ForgeWorkspaceModalProps) {
  // --- State ---
  const [forgedFiles, setForgedFiles] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Assistant Hook ---
  const {
    messages,
    isLoading,
    sendMessage,
    clearConversation,
  } = useAssistant({
    projectName,
    apiBasePath: '/api/agents',
    currentAgents,
    onToolCall: (tool, args, isPartial) => {
      // Intercept write_files to update local buffers
      if (tool.includes('write_files')) {
        const files = args.files as Record<string, string> | Array<{path: string, content: string}>;
        if (files) {
          const newFiles = { ...forgedFiles };
          if (Array.isArray(files)) {
            files.forEach(f => {
              newFiles[f.path] = f.content;
              if (!activeFile) setActiveFile(f.path);
            });
          } else {
            Object.entries(files).forEach(([path, content]) => {
              newFiles[path] = content;
              if (!activeFile) setActiveFile(path);
            });
          }
          setForgedFiles(newFiles);
        }
      }
    }
  });

  // --- Effects ---
  useEffect(() => {
    if (isOpen && initialDescription && messages.length === 0) {
      const prompt = `COMMAND: Use the forge_agent to IMMEDIATELY create a new python tool based on this description: ${initialDescription}. 
      
      DIRECTIVE: Skip all architectural discussion and confirmation steps. Proceed directly to calling 'write_files' via the forge_agent.
      
      LOCATION: The tool must be written to the 'tools/' directory within the current project.
      
      REQUIREMENT: Ensure 'tools/__init__.py' also exists.`;
      
      sendMessage(prompt);
    }
  }, [isOpen, initialDescription, messages.length, sendMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  // --- Handlers ---
  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    const content = inputValue.trim();
    setInputValue('');
    await sendMessage(content);
  };

  const handleFinalSave = async () => {
    setIsSaving(true);
    try {
      const filesToSave = Object.entries(forgedFiles).map(([filename, content]) => ({
        filename,
        content
      }));
      await onSave(filesToSave);
      onClose();
    } catch (error) {
      console.error('Failed to save forged tools:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const fileList = Object.keys(forgedFiles);

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
      <div className="bg-card border border-border/50 rounded-xl shadow-2xl w-full h-full max-w-[1400px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-primary/10 rounded-sm text-primary shadow-inner">
              <Wrench size={24} />
            </div>
            <div>
              <h2 className="text-xl font-heading font-bold text-foreground uppercase tracking-tight">The_Forge</h2>
              <p className="text-[10px] font-mono text-primary/60 uppercase tracking-widest">TRANSMUTATION_WORKSPACE_v3.1</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LoadingButton
              onClick={handleFinalSave}
              disabled={fileList.length === 0 || isSaving}
              isLoading={isSaving}
              loadingText="PERSISTING..."
              className="px-6 py-2 bg-primary text-primary-foreground rounded-sm text-xs font-bold uppercase tracking-widest font-mono flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20"
              variant="custom"
            >
              <Save size={16} />
              Save & Register
            </LoadingButton>
            <button 
              onClick={onClose}
              className="p-2 text-muted-foreground/40 hover:text-foreground transition-colors rounded-full hover:bg-muted"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Main Workspace Layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left: Chat Area (40%) */}
          <div className="w-[400px] border-r border-border flex flex-col bg-background/50">
            <div className="p-3 border-b border-border bg-muted/10 flex items-center gap-2">
              <MessageSquare size={14} className="text-primary/60" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Communication_Link</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {messages.map((m) => (
                <div key={m.id} className={`${m.role === 'user' ? 'ml-4' : 'mr-4'}`}>
                  <div className={`p-3 rounded-sm text-sm ${
                    m.role === 'user' 
                      ? 'bg-primary/5 border border-primary/10 text-foreground' 
                      : 'bg-muted/30 border border-border text-muted-foreground'
                  }`}>
                    {m.role === 'assistant' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-invert prose-xs max-w-none font-sans leading-relaxed">
                        {m.content}
                      </ReactMarkdown>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-xs font-mono text-primary/60 animate-pulse px-2">
                  <Loader2 size={12} className="animate-spin" />
                  PROCESSING_STREAM...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-border bg-muted/5">
              <div className="flex gap-2">
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Refine implementation..."
                  className="flex-1 bg-background border border-border rounded-sm px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-primary transition-all"
                />
                <button 
                  onClick={handleSend}
                  disabled={isLoading || !inputValue.trim()}
                  className="p-2 bg-primary text-primary-foreground rounded-sm disabled:opacity-50"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Code Preview (60%) */}
          <div className="flex-1 flex flex-col bg-[#1e1e1e]">
            {/* Tabs */}
            <div className="flex bg-muted/20 border-b border-border">
              {fileList.length === 0 ? (
                <div className="px-4 py-2 text-[10px] font-mono text-muted-foreground/40 italic flex items-center gap-2">
                  <Terminal size={12} />
                  AWAITING_ARTIFACT_STREAM...
                </div>
              ) : (
                fileList.map((filename) => (
                  <button
                    key={filename}
                    onClick={() => setActiveFile(filename)}
                    className={`px-4 py-2 text-xs font-mono border-r border-border transition-all flex items-center gap-2 ${
                      activeFile === filename 
                        ? 'bg-[#1e1e1e] text-primary border-t-2 border-t-primary' 
                        : 'text-muted-foreground hover:bg-muted/30'
                    }`}
                  >
                    <FileCode size={12} />
                    {filename.replace('tools/', '')}
                  </button>
                ))
              )}
            </div>

            {/* Editor */}
            <div className="flex-1 relative">
              {activeFile ? (
                <Editor
                  height="100%"
                  defaultLanguage={activeFile.endsWith('.py') ? 'python' : 'yaml'}
                  theme="vs-dark"
                  value={forgedFiles[activeFile]}
                  options={{
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    minimap: { enabled: false },
                    readOnly: true,
                    automaticLayout: true,
                    padding: { top: 20, bottom: 20 },
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/20 pointer-events-none">
                  <Sparkles size={48} className="mb-4 opacity-10 animate-pulse" />
                  <p className="text-xs font-mono uppercase tracking-[0.2em]">Matrix_Initializing...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
