'use client';

import { useRef, useEffect, useState } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useTheme } from 'next-themes';

interface YAMLEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  readOnly?: boolean;
  className?: string;
}

export default function YAMLEditor({ value, onChange, height = '400px', readOnly = false, className }: YAMLEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleChange: OnChange = (value) => {
    if (value !== undefined) {
      onChange(value);
    }
  };

  // Update editor value when prop changes
  useEffect(() => {
    if (editorRef.current) {
      const currentValue = editorRef.current.getValue();
      if (currentValue !== value) {
        editorRef.current.setValue(value);
      }
    }
  }, [value]);

  if (!mounted) return <div className={className} style={{ height }} />;

  return (
    <div className={className}>
      <Editor
        height={height}
        defaultLanguage="yaml"
        value={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 2,
          automaticLayout: true,
          readOnly,
        }}
        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light'}
      />
    </div>
  );
}
