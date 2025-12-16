/**
 * ChatInput Component
 *
 * Handles chat message input with file attachment and voice input support.
 * Features:
 * - Text input with auto-resize
 * - File attachment button with hidden file input
 * - Drag-and-drop file upload
 * - Image preview before send
 * - Remove attachment functionality
 * - Microphone button for voice-to-text (Deepgram Nova-3)
 */

import { useRef, useState, useCallback, useEffect } from 'react';

export interface Attachment {
  file: File;
  preview?: string;
}

interface DeepgramConfig {
  available: boolean;
  key?: string;
  model?: string;
  options?: {
    language?: string;
    smart_format?: boolean;
    punctuate?: boolean;
    interim_results?: boolean;
    utterance_end_ms?: number;
    vad_events?: boolean;
  };
  error?: string;
}

type DeepgramConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface ChatInputProps {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  isLoading: boolean;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  disabled?: boolean; // Disables input when agent has validation errors
}

export function ChatInput({
  input,
  setInput,
  onSend,
  onKeyDown,
  isLoading,
  attachments,
  setAttachments,
  disabled = false,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [deepgramConfig, setDeepgramConfig] = useState<DeepgramConfig | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<DeepgramConnectionStatus>('disconnected');

  // Refs for WebSocket and MediaRecorder
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch Deepgram config on mount
  useEffect(() => {
    const fetchDeepgramConfig = async () => {
      try {
        // Include x-e2e-test header for test environment detection
        const response = await fetch('/api/deepgram/token', {
          headers: {
            // Check for test mode indicators in the URL or document
            ...(typeof window !== 'undefined' &&
              (window.location.search.includes('e2e=true') ||
               document.cookie.includes('e2e-test=true') ||
               (window as unknown as { __E2E_TEST__?: boolean }).__E2E_TEST__)
              ? { 'x-e2e-test': 'true' }
              : {}),
          },
        });
        const config: DeepgramConfig = await response.json();
        setDeepgramConfig(config);
      } catch (error) {
        console.error('Failed to fetch Deepgram config:', error);
        setDeepgramConfig({ available: false, error: 'Failed to fetch config' });
      }
    };

    fetchDeepgramConfig();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const stopRecording = useCallback(() => {
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    // Close WebSocket
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
      socketRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setConnectionStatus('disconnected');
  }, []);

  const startRecording = useCallback(async () => {
    if (!deepgramConfig?.available || !deepgramConfig.key) {
      console.warn('Deepgram not available');
      return;
    }

    try {
      setConnectionStatus('connecting');
      setIsRecording(true);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Build WebSocket URL with options
      const options = deepgramConfig.options || {};
      const params = new URLSearchParams({
        model: deepgramConfig.model || 'nova-3',
        language: options.language || 'en-US',
        smart_format: String(options.smart_format ?? true),
        punctuate: String(options.punctuate ?? true),
        interim_results: String(options.interim_results ?? true),
        utterance_end_ms: String(options.utterance_end_ms ?? 1000),
        vad_events: String(options.vad_events ?? true),
      });

      // Connect to Deepgram WebSocket
      const socket = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params.toString()}`,
        ['token', deepgramConfig.key]
      );
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('Deepgram WebSocket connected');
        setConnectionStatus('connected');

        // Create MediaRecorder to capture audio
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm',
        });
        mediaRecorderRef.current = mediaRecorder;

        // Send audio data to Deepgram when available
        mediaRecorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          }
        });

        // Start recording with 250ms chunks for real-time transcription
        mediaRecorder.start(250);
      };

      socket.onmessage = (message) => {
        try {
          const received = JSON.parse(message.data);

          // Handle transcription results
          if (received.channel?.alternatives?.[0]?.transcript) {
            const transcript = received.channel.alternatives[0].transcript;
            const isFinal = received.is_final;

            if (transcript && isFinal) {
              // Append final transcript to input
              setInput((prev: string) => {
                const separator = prev.length === 0 || prev.endsWith(' ') ? '' : ' ';
                return prev + separator + transcript;
              });
            }
          }

          // Handle speech started event
          if (received.type === 'SpeechStarted') {
            console.log('Speech detected');
          }

          // Handle utterance end event
          if (received.type === 'UtteranceEnd') {
            console.log('Utterance ended');
          }
        } catch (error) {
          console.error('Error parsing Deepgram message:', error);
        }
      };

      socket.onerror = (error) => {
        console.error('Deepgram WebSocket error:', error);
        setConnectionStatus('error');
        stopRecording();
      };

      socket.onclose = (event) => {
        console.log('Deepgram WebSocket closed:', event.code, event.reason);
        if (isRecording) {
          setConnectionStatus('disconnected');
          stopRecording();
        }
      };
    } catch (error) {
      console.error('Failed to start recording:', error);
      setConnectionStatus('error');
      setIsRecording(false);
    }
  }, [deepgramConfig, isRecording, setInput, stopRecording]);

  const handleMicrophoneClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const newAttachments: Attachment[] = [];

    // Process all files, creating previews for images
    await Promise.all(
      fileArray.map((file) => {
        return new Promise<void>((resolve) => {
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const preview = e.target?.result as string;
              newAttachments.push({ file, preview });
              resolve();
            };
            reader.onerror = () => {
              // If reading fails, add without preview
              newAttachments.push({ file });
              resolve();
            };
            reader.readAsDataURL(file);
          } else {
            newAttachments.push({ file });
            resolve();
          }
        });
      })
    );

    // Add all new attachments at once
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, [setAttachments]);

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    const newAttachments = [...attachments];
    newAttachments.splice(index, 1);
    setAttachments(newAttachments);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const canSend = (input.trim() || attachments.length > 0) && !isLoading && !disabled;
  const deepgramAvailable = deepgramConfig?.available ?? false;

  return (
    <div className="p-4 border-t border-gray-200">
      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              data-testid="attachment-preview"
              className="relative group flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg border border-gray-200"
            >
              {attachment.preview ? (
                <img
                  src={attachment.preview}
                  alt={attachment.file.name}
                  className="w-10 h-10 object-cover rounded"
                />
              ) : (
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              )}
              <span
                data-testid="attachment-filename"
                className="text-sm text-gray-700 max-w-[150px] truncate"
              >
                {attachment.file.name}
              </span>
              <button
                data-testid="remove-attachment"
                onClick={() => handleRemoveAttachment(index)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove attachment"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area with Drop Zone */}
      <div
        data-testid="input-drop-zone"
        data-drag-active={isDragActive ? 'true' : 'false'}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex gap-3 transition-colors ${
          isDragActive ? 'ring-2 ring-blue-500 ring-offset-2 rounded-lg' : ''
        }`}
      >
        {/* File Input (hidden) */}
        <input
          ref={fileInputRef}
          type="file"
          data-testid="file-input"
          accept="image/*,.pdf,.txt,.json,.yaml,.yml,.md"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Attach Button */}
        <button
          data-testid="attach-file-button"
          onClick={handleAttachClick}
          className="relative p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Attach file"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          {attachments.length > 0 && (
            <span
              data-testid="attachment-count"
              className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-blue-500 text-white text-xs font-medium rounded-full"
            >
              {attachments.length}
            </span>
          )}
        </button>

        {/* Microphone Button */}
        <button
          data-testid="microphone-button"
          data-recording={isRecording ? 'true' : 'false'}
          data-deepgram-available={deepgramAvailable ? 'true' : 'false'}
          onClick={handleMicrophoneClick}
          disabled={!deepgramAvailable && !isRecording}
          className={`relative p-3 rounded-lg transition-colors ${
            isRecording
              ? 'text-red-600 bg-red-50 hover:bg-red-100'
              : deepgramAvailable
                ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                : 'text-gray-300 cursor-not-allowed'
          }`}
          title={
            !deepgramAvailable
              ? 'Voice input unavailable (Deepgram not configured)'
              : isRecording
                ? 'Stop voice input'
                : 'Start voice input'
          }
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          {/* Recording indicator */}
          {isRecording && (
            <span
              data-testid="recording-indicator"
              className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"
            />
          )}
          {/* Connection status indicator (shown during recording) */}
          {isRecording && (
            <span
              data-testid="deepgram-connection-status"
              data-status={connectionStatus}
              className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-green-500'
                  : connectionStatus === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : connectionStatus === 'error'
                      ? 'bg-red-500'
                      : 'bg-gray-400'
              }`}
              title={`Deepgram: ${connectionStatus}`}
            />
          )}
        </button>

        {/* Text Input */}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your message..."
          rows={1}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          disabled={isLoading || disabled}
          data-testid="chat-input"
        />

        {/* Send Button */}
        <button
          onClick={onSend}
          disabled={!canSend}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="send-button"
        >
          {isLoading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            'Send'
          )}
        </button>
      </div>

      {/* Drag overlay hint */}
      {isDragActive && (
        <div className="mt-2 text-center text-sm text-blue-600">
          Drop files here to attach
        </div>
      )}
    </div>
  );
}
