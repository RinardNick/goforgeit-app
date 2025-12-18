'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Navigation from '@/app/components/Navigation';
import type {
  ToolCall,
  Message,
  EventType,
  ADKEventPart,
  ADKEvent,
  EventFilter,
  DetailTab,
  PanelTab,
  StateEntry,
  InvocationInfo,
  AgentConfig,
} from '@/components/chat/types';
import {
  getHeatmapColor,
  processArtifactDelta,
  DeleteSessionDialog,
  ArtifactUploadModal,
  ArtifactPreviewModal,
  SessionsPanel,
  ArtifactsPanel,
  StatePanel,
  EventsPanel,
  TracePanel,
  ChatHeader,
  ChatInput,
  type Attachment,
} from '@/components/chat';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

export default function ADKAgentChatPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentName = params?.name as string;
  const initialSessionId = searchParams?.get('sessionId');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streamingEnabled, setStreamingEnabled] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sessions state (now part of unified Debug panel)
  const [sessions, setSessions] = useState<Array<{
    sessionId: string;
    createdAt: string;
    messageCount: number;
  }>>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // Unified Debug Panel state (contains: Sessions, Trace, Events, State, Artifacts)
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>('sessions');
  const [events, setEvents] = useState<ADKEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('event');

  // State Viewer state
  const [sessionState, setSessionState] = useState<StateEntry[]>([]);
  const [previousState, setPreviousState] = useState<Record<string, unknown>>({});

  // Raw JSON toggle for event details
  const [showRawJson, setShowRawJson] = useState(false);

  // Total execution time
  const [totalExecutionTime, setTotalExecutionTime] = useState<number | null>(null);

  // Artifacts state (now part of unified Debug panel)
  const [artifacts, setArtifacts] = useState<Array<{
    filename: string;
    scope: 'session' | 'user';
    version: number;
    mimeType?: string;
    timestamp: Date;
  }>>([]);

  // Upload Modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFilename, setUploadFilename] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Artifact download handler
  const handleDownloadArtifact = async (artifact: {
    filename: string;
    scope: 'session' | 'user';
  }) => {
    if (!sessionId) {
      console.error('No session ID available for artifact download');
      return;
    }

    try {
      // Construct the ADK API URL based on artifact scope
      const artifactPath = artifact.scope === 'session'
        ? `/api/adk-proxy/projects/${agentName}/sessions/${sessionId}/artifacts/${artifact.filename}`
        : `/api/adk-proxy/projects/${agentName}/artifacts/${artifact.filename}`;

      // Fetch the artifact
      const response = await fetch(artifactPath);
      if (!response.ok) {
        throw new Error(`Failed to download artifact: ${response.statusText}`);
      }

      // Get the blob and create a download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = artifact.filename.replace('user:', ''); // Remove user: prefix for filename
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading artifact:', error);
    }
  };

  // Artifact upload handler
  const handleUploadArtifact = async () => {
    if (!uploadFile || !uploadFilename || !sessionId) {
      setUploadError('Please provide both filename and file');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append('file', uploadFile);

      // Construct the ADK API URL
      // For user-scoped artifacts, use the user artifacts endpoint
      // For session-scoped artifacts, use the session artifacts endpoint
      const isUserScoped = uploadFilename.startsWith('user:');
      const artifactPath = isUserScoped
        ? `/api/adk-proxy/projects/${agentName}/artifacts/${uploadFilename}`
        : `/api/adk-proxy/projects/${agentName}/sessions/${sessionId}/artifacts/${uploadFilename}`;

      // Upload the artifact
      const response = await fetch(artifactPath, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload artifact: ${response.statusText}`);
      }

      // Add the artifact to the local list
      const newArtifact = {
        filename: uploadFilename,
        scope: (isUserScoped ? 'user' : 'session') as 'session' | 'user',
        version: 1,
        mimeType: uploadFile.type,
        timestamp: new Date(),
      };
      setArtifacts(prev => [...prev, newArtifact]);

      // Close modal and reset form
      setShowUploadModal(false);
      setUploadFilename('');
      setUploadFile(null);
      setUploadError(null);
    } catch (error) {
      console.error('Error uploading artifact:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const [selectedArtifact, setSelectedArtifact] = useState<{
    filename: string;
    scope: 'session' | 'user';
    version: number;
    mimeType?: string;
    timestamp: Date;
  } | null>(null);

  // Invocations grouped by user message
  const [invocations, setInvocations] = useState<InvocationInfo[]>([]);

  // Agent config for request display
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Format agent name for display
  const displayName = agentName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  // Fetch agent config for request display
  useEffect(() => {
    const fetchAgentConfig = async () => {
      try {
        const response = await fetch(`/api/adk-proxy/builder/app/${agentName}`);
        if (response.ok) {
          const yamlText = await response.text();
          // Parse YAML manually for key fields
          const nameMatch = yamlText.match(/^name:\s*(.+)$/m);
          const modelMatch = yamlText.match(/^model:\s*(.+)$/m);
          const instructionMatch = yamlText.match(/instruction:\s*>\s*\n([\s\S]*?)(?=\n\w|$)/);
          const descMatch = yamlText.match(/^description:\s*(.+)$/m);
          const subAgentsMatch = yamlText.match(/sub_agents:\s*\n([\s\S]*?)(?=\n\w|$)/);

          setAgentConfig({
            name: nameMatch?.[1]?.trim() || agentName,
            model: modelMatch?.[1]?.trim() || 'unknown',
            instruction: instructionMatch?.[1]?.trim().replace(/\n\s+/g, ' '),
            description: descMatch?.[1]?.trim(),
            subAgents: subAgentsMatch?.[1]?.match(/config_path:\s*(\S+)/g)?.map(m => m.replace('config_path:', '').trim()),
          });
        }
      } catch (err) {
        console.error('Failed to fetch agent config:', err);
      }
    };
    fetchAgentConfig();
  }, [agentName]);

  // Helper to parse ADK event and compute display fields
  const parseADKEvent = (rawEvent: Record<string, unknown>): ADKEvent => {
    const event = rawEvent as {
      id: string;
      timestamp: number;
      invocationId: string;
      author: string;
      content?: {
        parts?: ADKEventPart[];
        role?: string;
      };
      modelVersion?: string;
      finishReason?: string;
      usageMetadata?: Record<string, unknown>;
      avgLogprobs?: number;
      actions?: {
        stateDelta?: Record<string, unknown>;
        artifactDelta?: Record<string, unknown>;
        transferToAgent?: string;
        requestedAuthConfigs?: Record<string, unknown>;
        requestedToolConfirmations?: Record<string, unknown>;
      };
      longRunningToolIds?: string[];
    };

    // Determine event type and title from content
    let eventType: EventType = 'text';
    let title = '';
    let displayContent = '';

    if (event.content?.parts) {
      for (const part of event.content.parts) {
        if (part.functionCall) {
          eventType = 'functionCall';
          title = `functionCall:${part.functionCall.name}`;
          displayContent = `Called ${part.functionCall.name}`;
          break;
        } else if (part.functionResponse) {
          eventType = 'functionResponse';
          title = `functionResponse:${part.functionResponse.name}`;
          displayContent = `Response from ${part.functionResponse.name}`;
          break;
        } else if (part.text) {
          eventType = 'text';
          title = `text:${part.text.slice(0, 50)}${part.text.length > 50 ? '...' : ''}`;
          displayContent = part.text;
        }
      }
    }

    return {
      ...event,
      eventType,
      title,
      displayContent,
      usageMetadata: event.usageMetadata as ADKEvent['usageMetadata'],
    };
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const executionStartTime = Date.now();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      if (streamingEnabled) {
        // Streaming mode
        const response = await fetch(`/api/adk-agents/${agentName}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage.content,
            streaming: true,
            ...(sessionId && { sessionId }),
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to execute agent');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let fullResponse = '';
        let newEventIds: string[] = [];
        let streamSessionId = sessionId;
        let finalEvents: ADKEvent[] = [];

        // Create placeholder assistant message
        const assistantMessageId = (Date.now() + 1).toString();
        setMessages((prev) => [...prev, {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        }]);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.type === 'text') {
                    fullResponse += data.content;
                    // Update the message in real-time
                    setMessages((prev) => prev.map(m =>
                      m.id === assistantMessageId
                        ? { ...m, content: fullResponse }
                        : m
                    ));
                  } else if (data.type === 'done') {
                    streamSessionId = data.sessionId;
                    if (data.events) {
                      finalEvents = data.events.map((e: Record<string, unknown>) => parseADKEvent(e));
                      newEventIds = finalEvents.map((e: ADKEvent) => e.id);
                    }
                  } else if (data.type === 'error') {
                    throw new Error(data.error);
                  }
                } catch (parseError) {
                  // Skip non-JSON lines
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Store session ID
        if (streamSessionId) {
          setSessionId(streamSessionId);
        }

        // Process events
        if (finalEvents.length > 0) {
          setEvents((prev) => [...prev, ...finalEvents]);

          const executionEndTime = Date.now();
          const execTime = executionEndTime - executionStartTime;
          setTotalExecutionTime(execTime);

          const invocationMap = new Map<string, ADKEvent[]>();
          for (const event of finalEvents) {
            const invId = event.invocationId;
            if (!invocationMap.has(invId)) {
              invocationMap.set(invId, []);
            }
            invocationMap.get(invId)!.push(event);
          }

          const newInvocations: InvocationInfo[] = [];
          invocationMap.forEach((invEvents, invId) => {
            newInvocations.push({
              invocationId: invId,
              userMessage: userMessage.content,
              timestamp: userMessage.timestamp,
              events: invEvents,
              totalTime: execTime,
            });
          });
          setInvocations((prev) => [...prev, ...newInvocations]);

          for (const event of finalEvents) {
            if (event.actions?.stateDelta && Object.keys(event.actions.stateDelta).length > 0) {
              updateSessionState({ ...previousState, ...event.actions.stateDelta });
            }

            // Process artifacts from artifactDelta
            if (event.actions?.artifactDelta && Object.keys(event.actions.artifactDelta).length > 0) {
              const newArtifacts = processArtifactDelta(event.actions.artifactDelta);
              setArtifacts((prev) => {
                // Merge with existing artifacts, updating version if filename exists
                const updated = [...prev];
                for (const newArtifact of newArtifacts) {
                  const existingIndex = updated.findIndex(a => a.filename === newArtifact.filename);
                  if (existingIndex >= 0) {
                    // Update existing artifact with new version
                    updated[existingIndex] = newArtifact;
                  } else {
                    // Add new artifact
                    updated.push(newArtifact);
                  }
                }
                return updated;
              });
            }
          }
        }

        // Update final message with event IDs
        setMessages((prev) => prev.map(m =>
          m.id === assistantMessageId
            ? { ...m, eventIds: newEventIds }
            : m
        ));

      } else {
        // Non-streaming mode (original code)
        const response = await fetch(`/api/adk-agents/${agentName}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage.content,
            ...(sessionId && { sessionId }),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to execute agent');
        }

        // Store session ID for conversation continuity
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }

        // Process real ADK events
        let newEventIds: string[] = [];
        if (data.events && Array.isArray(data.events)) {
          const parsedEvents = data.events.map((e: Record<string, unknown>) => parseADKEvent(e));
          newEventIds = parsedEvents.map((e: ADKEvent) => e.id);
          setEvents((prev) => [...prev, ...parsedEvents]);

          // Calculate total execution time
          const executionEndTime = Date.now();
          const execTime = executionEndTime - executionStartTime;
          setTotalExecutionTime(execTime);

          // Group events by invocationId and create invocation entries
          const invocationMap = new Map<string, ADKEvent[]>();
          for (const event of parsedEvents) {
            const invId = event.invocationId;
            if (!invocationMap.has(invId)) {
              invocationMap.set(invId, []);
            }
            invocationMap.get(invId)!.push(event);
          }

          // Create invocation info for each unique invocationId
          const newInvocations: InvocationInfo[] = [];
          invocationMap.forEach((invEvents, invId) => {
            newInvocations.push({
              invocationId: invId,
              userMessage: userMessage.content,
              timestamp: userMessage.timestamp,
              events: invEvents,
              totalTime: execTime,
            });
          });
          setInvocations((prev) => [...prev, ...newInvocations]);

          // Update session state from events
          for (const event of parsedEvents) {
            if (event.actions?.stateDelta && Object.keys(event.actions.stateDelta).length > 0) {
              updateSessionState({ ...previousState, ...event.actions.stateDelta });
            }

            // Process artifacts from artifactDelta
            if (event.actions?.artifactDelta && Object.keys(event.actions.artifactDelta).length > 0) {
              const newArtifacts = processArtifactDelta(event.actions.artifactDelta);
              setArtifacts((prev) => {
                // Merge with existing artifacts, updating version if filename exists
                const updated = [...prev];
                for (const newArtifact of newArtifacts) {
                  const existingIndex = updated.findIndex(a => a.filename === newArtifact.filename);
                  if (existingIndex >= 0) {
                    // Update existing artifact with new version
                    updated[existingIndex] = newArtifact;
                  } else {
                    // Add new artifact
                    updated.push(newArtifact);
                  }
                }
                return updated;
              });
            }
          }
        }

        // Create assistant message with event IDs
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response || 'No response',
          timestamp: new Date(),
          toolCalls: data.toolCalls,
          eventIds: newEventIds,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setSessionId(null);
    setError(null);
    setEvents([]);
    setInvocations([]);
    setSelectedEventIndex(null);
    setTotalExecutionTime(null);
    setSessionState([]);
    setPreviousState({});
    // Clear session-scoped artifacts, but keep user-scoped ones
    setArtifacts((prev) => prev.filter(a => a.scope === 'user'));
    // Clear any pending attachments
    setAttachments([]);
  };

  // Fetch sessions list
  const fetchSessions = async () => {
    try {
      const response = await fetch(`/api/adk-agents/${agentName}/sessions`);
      if (!response.ok) {
        console.error('Failed to fetch sessions');
        return;
      }
      const data = await response.json();
      // Transform ADK response to our format
      // ADK list sessions doesn't return timestamps/counts, so we fetch each session's details
      const sessionsWithDetails = await Promise.all(
        (data.sessions || []).map(async (s: { session_id: string }) => {
          try {
            // Fetch session details to get lastUpdateTime and events count
            const detailRes = await fetch(`/api/adk-agents/${agentName}/sessions/${s.session_id}`);
            if (detailRes.ok) {
              const detail = await detailRes.json();
              return {
                sessionId: s.session_id,
                createdAt: detail.lastUpdateTime
                  ? new Date(detail.lastUpdateTime * 1000).toISOString()
                  : new Date().toISOString(),
                messageCount: detail.events ? Math.ceil(detail.events.length / 2) : 0,
              };
            }
          } catch {
            // Fallback if detail fetch fails
          }
          return {
            sessionId: s.session_id,
            createdAt: new Date().toISOString(),
            messageCount: 0,
          };
        })
      );
      setSessions(sessionsWithDetails);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  // Create new session
  const handleCreateSession = async () => {
    try {
      const response = await fetch(`/api/adk-agents/${agentName}/sessions`, {
        method: 'POST',
      });
      if (!response.ok) {
        console.error('Failed to create session');
        return;
      }
      const data = await response.json();
      const newSessionId = data.session_id || data.sessionId;
      // Clear current chat
      handleNewConversation();
      // Refresh sessions list first to include the new session
      await fetchSessions();
      // Then set the new session as active
      setSessionId(newSessionId);
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  // Delete session with confirmation
  const handleDeleteSession = (sid: string) => {
    setSessionToDelete(sid);
    setShowDeleteDialog(true);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;

    try {
      const response = await fetch(`/api/adk-agents/${agentName}/sessions/${sessionToDelete}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        console.error('Failed to delete session');
        return;
      }

      // Refresh sessions list first to get updated data
      await fetchSessions();

      // If we deleted the active session, switch to another or create new
      if (sessionToDelete === sessionId) {
        // Get remaining sessions from the refreshed list
        const remainingSessions = await fetch(`/api/adk-agents/${agentName}/sessions`).then(r => r.json()).then(data => data.sessions || []);

        if (remainingSessions.length > 0) {
          // Switch to the first remaining session
          const firstSession = remainingSessions[0];
          await switchToSession(firstSession.session_id);
        } else {
          // No sessions left, clear everything including sessionId
          handleNewConversation();
          setSessionId(null);
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    } finally {
      setShowDeleteDialog(false);
      setSessionToDelete(null);
    }
  };

  // Update session state via PATCH endpoint
  const handleStateUpdate = async (key: string, value: unknown) => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/adk-agents/${agentName}/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stateDelta: { [key]: value } }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to update state');
      }

      const data = await response.json();

      // Update local state from response
      if (data.state) {
        const newEntries: StateEntry[] = Object.entries(data.state).map(([k, v]) => ({
          key: k,
          value: v,
          scope: 'session' as const,
          changed: k === key, // Mark the updated key as changed
        }));
        setSessionState(newEntries);
      }
    } catch (error) {
      console.error('Error updating session state:', error);
      throw error;
    }
  };

  // Switch to a different session
  const switchToSession = async (sid: string) => {
    try {
      // Fetch session details including events
      const response = await fetch(`/api/adk-agents/${agentName}/sessions/${sid}`);
      if (!response.ok) {
        console.error('Failed to fetch session details');
        return;
      }
      const data = await response.json();

      // Update session ID
      setSessionId(sid);

      // Convert ADK events to messages
      // Events from ADK session history have: content: { role, parts: [{ text }] }
      // Optional fields: id, timestamp, author
      const loadedMessages: Message[] = [];
      const rawEvents = data.events || [];

      console.log('Loading session events:', rawEvents.length, 'events');

      // Parse events for the debug panels (trace, events tabs)
      const parsedEvents: ADKEvent[] = [];
      const loadedArtifacts: Array<{
        filename: string;
        scope: 'session' | 'user';
        version: number;
        mimeType?: string;
        timestamp: Date;
      }> = [];

      for (let i = 0; i < rawEvents.length; i++) {
        const rawEvent = rawEvents[i];

        // Generate ID if not present
        if (!rawEvent.id) {
          rawEvent.id = `loaded-${i}-${Date.now()}`;
        }
        if (!rawEvent.timestamp) {
          rawEvent.timestamp = Date.now() / 1000;
        }
        if (!rawEvent.invocationId) {
          rawEvent.invocationId = `inv-${i}`;
        }
        if (!rawEvent.author) {
          rawEvent.author = rawEvent.content?.role === 'user' ? 'user' : 'agent';
        }

        // Parse the event for debug panels
        const parsedEvent = parseADKEvent(rawEvent);
        parsedEvents.push(parsedEvent);

        // Process artifacts from artifactDelta
        if (parsedEvent.actions?.artifactDelta && Object.keys(parsedEvent.actions.artifactDelta).length > 0) {
          const newArtifacts = processArtifactDelta(parsedEvent.actions.artifactDelta);
          for (const artifact of newArtifacts) {
            const existingIndex = loadedArtifacts.findIndex(a => a.filename === artifact.filename);
            if (existingIndex >= 0) {
              loadedArtifacts[existingIndex] = artifact;
            } else {
              loadedArtifacts.push(artifact);
            }
          }
        }

        // Skip events without content or text for messages
        if (!rawEvent.content?.parts) continue;

        const textParts = rawEvent.content.parts
          .filter((p: { text?: string }) => p.text)
          .map((p: { text?: string }) => p.text)
          .join('');

        if (!textParts) continue;

        // Determine role: 'user' role in content means user message,
        // otherwise it's from an agent (assistant)
        const role = rawEvent.content.role === 'user' ? 'user' : 'assistant';

        // Extract tool calls if present
        const toolCalls: ToolCall[] = rawEvent.content.parts
          .filter((p: { functionCall?: unknown }) => p.functionCall)
          .map((p: { functionCall: { name: string; args: Record<string, unknown> } }) => ({
            name: p.functionCall.name,
            args: p.functionCall.args,
            status: 'success' as const,
          }));

        const timestamp = rawEvent.timestamp
          ? new Date(rawEvent.timestamp * 1000)
          : new Date();

        loadedMessages.push({
          id: rawEvent.id,
          role,
          content: textParts,
          timestamp,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          eventIds: [rawEvent.id],
        });
      }

      console.log('Converted to messages:', loadedMessages.length, 'and events:', parsedEvents.length);
      setMessages(loadedMessages);
      setEvents(parsedEvents);

      // Build invocations from parsed events (group by invocationId)
      const invocationMap = new Map<string, ADKEvent[]>();
      for (const event of parsedEvents) {
        const invId = event.invocationId;
        if (!invocationMap.has(invId)) {
          invocationMap.set(invId, []);
        }
        invocationMap.get(invId)!.push(event);
      }

      const loadedInvocations: InvocationInfo[] = [];
      invocationMap.forEach((invEvents, invId) => {
        // Find the user message for this invocation
        const userEvent = invEvents.find(e => e.content?.role === 'user');
        const userMessage = userEvent?.displayContent || 'User message';
        const firstTimestamp = invEvents[0]?.timestamp
          ? new Date(invEvents[0].timestamp * 1000)
          : new Date();

        loadedInvocations.push({
          invocationId: invId,
          userMessage,
          timestamp: firstTimestamp,
          events: invEvents,
        });
      });
      setInvocations(loadedInvocations);

      // Load artifacts
      if (loadedArtifacts.length > 0) {
        setArtifacts(loadedArtifacts);
      } else {
        setArtifacts([]);
      }

      // Load state if available
      if (data.state && Object.keys(data.state).length > 0) {
        updateSessionState(data.state);
      } else {
        setSessionState([]);
        setPreviousState({});
      }

      // Reset selection state
      setSelectedEventIndex(null);
      setTotalExecutionTime(null);
    } catch (error) {
      console.error('Error switching session:', error);
    }
  };

  // Load sessions on mount
  useEffect(() => {
    fetchSessions();
  }, [agentName]);

  // Validate agent configuration on mount
  useEffect(() => {
    const validateAgent = async () => {
      try {
        const response = await fetch(`/api/adk-agents/${agentName}/validate`);
        if (response.ok) {
          const data = await response.json();
          if (!data.valid) {
            // Find the first error message
            const firstError = Object.values(data.results as Record<string, { errors: Array<{ message: string }> }>)
              .flatMap(r => r.errors)
              .map(e => e.message)[0];
            setValidationError(firstError || 'Agent has broken references');
          }
        }
      } catch (err) {
        console.error('Validation check failed:', err);
      }
    };
    validateAgent();
  }, [agentName]);

  // Load session from URL query parameter if provided
  useEffect(() => {
    if (initialSessionId && !sessionId) {
      switchToSession(initialSessionId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId]);

  // Helper function to update session state
  const updateSessionState = (newState: Record<string, unknown>) => {
    const entries: StateEntry[] = Object.entries(newState).map(([key, value]) => {
      const isUserScoped = key.startsWith('user:');
      const cleanKey = isUserScoped ? key.slice(5) : key;
      const prevValue = previousState[key];
      const hasChanged = prevValue !== undefined && JSON.stringify(prevValue) !== JSON.stringify(value);

      return {
        key: cleanKey,
        value,
        previousValue: hasChanged ? prevValue : undefined,
        scope: isUserScoped ? 'user' : 'session',
        changed: hasChanged,
      };
    });

    setSessionState(entries);
    setPreviousState(newState);
  };

  // Filter events based on selected filter
  const filteredEvents = events.filter((event) => {
    if (eventFilter === 'all') return true;
    if (eventFilter === 'messages') return event.eventType === 'text';
    if (eventFilter === 'tools') return event.eventType === 'functionCall' || event.eventType === 'functionResponse';
    return true;
  });

  // Clear all events
  const clearEvents = () => {
    setEvents([]);
    setInvocations([]);
    setSelectedEventIndex(null);
    setTotalExecutionTime(null);
  };

  // Get events for a specific message by event IDs
  const getEventsForMessage = (eventIds: string[] | undefined) => {
    if (!eventIds || eventIds.length === 0) return [];
    return events.filter(e => eventIds.includes(e.id));
  };

  // Handle clicking on an inline event indicator
  const handleInlineEventClick = (eventId: string) => {
    // Open debug panel if not already open
    setShowDebugPanel(true);
    // Find the index of this event in the events array
    const eventIndex = events.findIndex(e => e.id === eventId);
    if (eventIndex !== -1) {
      setSelectedEventIndex(eventIndex);
    }
  };

  // Get inline events to show (function calls, function responses, transfers)
  const getInlineEvents = (eventIds: string[] | undefined) => {
    const messageEvents = getEventsForMessage(eventIds);
    return messageEvents.filter(e =>
      e.eventType === 'functionCall' ||
      e.eventType === 'functionResponse' ||
      e.actions?.transferToAgent
    );
  };

  return (
    <div className="min-h-screen bg-sandstone">
      <Navigation />
      <main className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <ChatHeader
          agentName={agentName}
          displayName={displayName}
          streamingEnabled={streamingEnabled}
          setStreamingEnabled={setStreamingEnabled}
          showDebugPanel={showDebugPanel}
          setShowDebugPanel={setShowDebugPanel}
          setPanelTab={setPanelTab}
          onNewConversation={handleNewConversation}
          onNavigateBack={() => router.push('/adk-agents')}
        />

        {/* Session ID Badge */}
        {sessionId && (
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
            <span>Session:</span>
            <code className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">
              {sessionId.slice(0, 8)}...
            </code>
          </div>
        )}

        {/* Main Layout - Chat + Debug Panel */}
        <div className="flex gap-4" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
          {/* Chat Interface */}
          <div
            data-testid="chat-container"
            className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col ${
              showDebugPanel ? 'flex-1' : 'w-full max-w-4xl mx-auto'
            }`}
          >
            {/* Messages Area */}
            <div data-testid="chat-messages" className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Chat with {displayName}</h3>
                  <p className="text-gray-500 max-w-sm">
                    This agent is powered by the real ADK backend. Send a message to start the conversation.
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((message, msgIndex) => {
                    const inlineEvents = message.role === 'assistant' ? getInlineEvents(message.eventIds) : [];
                    const hasToolEvents = inlineEvents.length > 0;

                    return (
                      <div
                        key={message.id}
                        data-testid={`message-${message.id}`}
                        className="space-y-2"
                      >
                        {/* Tool call indicators - shown BEFORE the response as separate cards */}
                        {hasToolEvents && (
                          <div className="flex justify-start">
                            <div className="ml-10 flex flex-col gap-1">
                              {inlineEvents.map((event) => {
                                const funcCall = event.content?.parts?.find((p: ADKEventPart) => p.functionCall)?.functionCall;
                                const funcResp = event.content?.parts?.find((p: ADKEventPart) => p.functionResponse)?.functionResponse;
                                const isTransfer = event.actions?.transferToAgent;

                                return (
                                  <button
                                    key={event.id}
                                    onClick={() => handleInlineEventClick(event.id)}
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                                      event.eventType === 'functionCall'
                                        ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200'
                                        : event.eventType === 'functionResponse'
                                        ? 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200'
                                        : isTransfer
                                        ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200'
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'
                                    }`}
                                    title="Click to view event details"
                                  >
                                    {event.eventType === 'functionCall' && (
                                      <>
                                        <span>⚡️</span>
                                        <span>{funcCall?.name || 'function'}</span>
                                      </>
                                    )}
                                    {event.eventType === 'functionResponse' && (
                                      <>
                                        <span>✓</span>
                                        <span>{funcResp?.name || 'response'}</span>
                                        {isTransfer && (
                                          <span className="text-purple-600 ml-1">→ {event.actions?.transferToAgent}</span>
                                        )}
                                      </>
                                    )}
                                    {!event.eventType.includes('function') && isTransfer && (
                                      <>
                                        <span>🔄</span>
                                        <span>→ {event.actions?.transferToAgent}</span>
                                      </>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Message bubble */}
                        <div
                          data-testid={message.role === 'assistant' ? 'message-assistant' : 'message-user'}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {message.role === 'assistant' && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mr-2">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-3 ${
                              message.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            {message.role === 'assistant' && (
                              <div className="text-xs font-medium text-purple-600 mb-1">
                                {displayName}
                              </div>
                            )}

                            <p className="whitespace-pre-wrap">{message.content}</p>
                            <p
                              className={`text-xs mt-1 ${
                                message.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                              }`}
                            >
                              {message.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="border-t border-red-200">
                <ErrorMessage message={error} className="rounded-none border-x-0 border-b-0" />
              </div>
            )}

            {/* Validation Error Message */}
            {validationError && (
              <div className="p-4 bg-red-50 border-t border-red-200" data-testid="validation-error-message">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-red-800 mb-1">Validation Error</h4>
                    <p className="text-sm text-red-700">
                      Cannot run agent with broken references: {validationError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Input Area with File Attachments */}
            <ChatInput
              input={input}
              setInput={setInput}
              onSend={handleSendMessage}
              onKeyDown={handleKeyDown}
              isLoading={isLoading}
              attachments={attachments}
              setAttachments={setAttachments}
              disabled={!!validationError}
            />
          </div>


          {/* Debug Panel - Side Panel */}
          {showDebugPanel && (
            <div
              data-testid="events-panel"
              className="w-[500px] bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden"
            >
              {/* Panel Tabs Header */}
              <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                {/* Main Panel Tabs */}
                <div className="flex">
                  <button
                    data-testid="debug-tab-sessions"
                    onClick={() => setPanelTab('sessions')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      panelTab === 'sessions'
                        ? 'border-blue-500 text-blue-600 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Sessions ({sessions.length})
                  </button>
                  <button
                    data-testid="debug-tab-trace"
                    onClick={() => { setPanelTab('trace'); setSelectedEventIndex(null); }}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      panelTab === 'trace'
                        ? 'border-blue-500 text-blue-600 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Trace
                  </button>
                  <button
                    data-testid="debug-tab-events"
                    onClick={() => { setPanelTab('events'); setSelectedEventIndex(null); }}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      panelTab === 'events'
                        ? 'border-blue-500 text-blue-600 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Events ({events.length})
                  </button>
                  <button
                    data-testid="debug-tab-state"
                    onClick={() => setPanelTab('state')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      panelTab === 'state'
                        ? 'border-blue-500 text-blue-600 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    State ({sessionState.length})
                  </button>
                  <button
                    data-testid="debug-tab-artifacts"
                    onClick={() => setPanelTab('artifacts')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      panelTab === 'artifacts'
                        ? 'border-blue-500 text-blue-600 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Artifacts ({artifacts.length})
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={clearEvents}
                    data-testid="clear-events-button"
                    className="px-3 py-3 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* ========== TRACE TAB ========== */}
              {panelTab === 'trace' && (
                <TracePanel
                  isLoading={isLoading}
                  invocations={invocations}
                  selectedEventIndex={selectedEventIndex}
                  setSelectedEventIndex={setSelectedEventIndex}
                  detailTab={detailTab}
                  setDetailTab={setDetailTab}
                  showRawJson={showRawJson}
                  setShowRawJson={setShowRawJson}
                  agentConfig={agentConfig}
                />
              )}

              {/* ========== EVENTS TAB ========== */}
              {panelTab === 'events' && (
                <EventsPanel
                  events={events}
                  eventFilter={eventFilter}
                  setEventFilter={setEventFilter}
                  filteredEvents={filteredEvents}
                  selectedEventIndex={selectedEventIndex}
                  setSelectedEventIndex={setSelectedEventIndex}
                  detailTab={detailTab}
                  setDetailTab={setDetailTab}
                  invocations={invocations}
                  agentConfig={agentConfig}
                />
              )}

              {/* ========== STATE TAB ========== */}
              {panelTab === 'state' && (
                <StatePanel
                  sessionState={sessionState}
                  onStateUpdate={sessionId ? handleStateUpdate : undefined}
                />
              )}

              {/* ========== SESSIONS TAB ========== */}
              {panelTab === 'sessions' && (
                <SessionsPanel
                  sessions={sessions}
                  sessionId={sessionId}
                  onCreateSession={handleCreateSession}
                  onSwitchSession={switchToSession}
                  onDeleteSession={handleDeleteSession}
                />
              )}

              {/* ========== ARTIFACTS TAB ========== */}
              {panelTab === 'artifacts' && (
                <ArtifactsPanel
                  artifacts={artifacts}
                  onUploadClick={() => setShowUploadModal(true)}
                  onArtifactClick={setSelectedArtifact}
                  onDownloadArtifact={handleDownloadArtifact}
                />
              )}
            </div>
          )}


          {/* Artifact Preview Modal */}
          <ArtifactPreviewModal
            artifact={selectedArtifact}
            agentName={agentName}
            sessionId={sessionId}
            onClose={() => setSelectedArtifact(null)}
            onDownload={handleDownloadArtifact}
          />
        </div>
      </main>

      {/* Upload Artifact Modal */}
      <ArtifactUploadModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadFilename('');
          setUploadFile(null);
          setUploadError(null);
        }}
        uploadFilename={uploadFilename}
        setUploadFilename={setUploadFilename}
        uploadFile={uploadFile}
        setUploadFile={setUploadFile}
        uploadError={uploadError}
        isUploading={isUploading}
        onUpload={handleUploadArtifact}
      />

      {/* Delete Session Confirmation Dialog */}
      <DeleteSessionDialog
        isOpen={showDeleteDialog}
        onCancel={() => {
          setShowDeleteDialog(false);
          setSessionToDelete(null);
        }}
        onConfirm={confirmDeleteSession}
      />

      {/* Empty state for trace (when panel is closed) */}
      {!showDebugPanel && events.length === 0 && <div data-testid="trace-empty-state" className="hidden">No execution trace</div>}
    </div>
  );
}
