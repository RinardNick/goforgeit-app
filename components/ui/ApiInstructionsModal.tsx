'use client';

import React, { useState } from 'react';
import { X, Check, Copy, Code, Terminal, Zap } from 'lucide-react';

interface ApiInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
}

export function ApiInstructionsModal({
  isOpen,
  onClose,
  agentName,
}: ApiInstructionsModalProps) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.goforgeit.com';
  const apiUrl = `${origin}/api/agents/${agentName}/execute`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const curlCommand = `curl -X POST ${apiUrl} \
  -H "Content-Type: application/json" \
  -H "X-Forge-Api-Key: YOUR_API_KEY" \
  -d '{ 
    "message": "Hello, how can you help me today?", 
    "streaming": true 
  }'`;

  const jsCode = `const response = await fetch("${apiUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Forge-Api-Key": "YOUR_API_KEY"
  },
  body: JSON.stringify({
    message: "Hello!",
    streaming: true
  })
});

// For streaming response (SSE)
const reader = response.body.getReader();
const decoder = new TextEncoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  console.log(chunk);
}`;

  const pythonCode = `import requests
import json

url = "${apiUrl}"
headers = {
    "Content-Type": "application/json",
    "X-Forge-Api-Key": "YOUR_API_KEY"
}
data = {
    "message": "Hello!",
    "streaming": False
}

response = requests.post(url, headers=headers, json=data)
print(response.json())`;

  const sections = [
    { id: 'curl', title: 'cURL', icon: <Terminal className="w-4 h-4" />, code: curlCommand, lang: 'bash' },
    { id: 'js', title: 'JavaScript', icon: <Code className="w-4 h-4" />, code: jsCode, lang: 'javascript' },
    { id: 'python', title: 'Python', icon: <Zap className="w-4 h-4" />, code: pythonCode, lang: 'python' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              API INTEGRATION
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Instructions for connecting external apps to <span className="font-mono font-bold text-primary">{agentName}</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* Endpoint Info */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-muted/20 rounded-lg border border-border">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Endpoint URL</h3>
              <div className="flex items-center gap-2 font-mono text-sm break-all bg-background p-2 rounded border border-border/50">
                {apiUrl}
              </div>
            </div>
            <div className="p-4 bg-muted/20 rounded-lg border border-border">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Authentication</h3>
              <p className="text-sm text-foreground mb-2 italic">Requires X-Forge-Api-Key header.</p>
              <div className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 p-2 rounded">
                Get your key in <strong>Settings &gt; API Keys</strong>
              </div>
            </div>
          </div>

          {/* Code Snippets */}
          <div className="space-y-6">
            {sections.map((section) => (
              <div key={section.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    {section.icon}
                    {section.title}
                  </h3>
                  <button
                    onClick={() => copyToClipboard(section.code, section.id)}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 rounded transition-all"
                  >
                    {copied === section.id ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy Code
                      </>
                    )}
                  </button>
                </div>
                <div className="relative group">
                  <pre className="p-4 bg-zinc-950 text-zinc-300 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed border border-white/5">
                    {section.code}
                  </pre>
                </div>
              </div>
            ))}
          </div>

          {/* Response Info */}
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg">
            <h3 className="text-sm font-bold text-primary mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Streaming Support
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When <code className="text-primary font-bold">streaming: true</code> is passed in the request body, 
              the server responds with <strong>Server-Sent Events (SSE)</strong>. Each chunk contains partial text 
              or execution events (tool calls, switches) formatted as JSON.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-muted/30 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
