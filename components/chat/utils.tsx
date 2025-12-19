/**
 * Utility functions for the ADK Agent Chat interface
 */

import type { ADKEvent, InvocationInfo, AgentConfig } from './types';

/**
 * Get heatmap color based on duration in milliseconds
 * Fast (<200ms) = green, Medium (200-500ms) = yellow,
 * Slow (500-1000ms) = orange, Very slow (>1000ms) = red
 */
export function getHeatmapColor(durationMs: number): { barColor: string; testId?: string } {
  if (durationMs >= 1000) {
    return { barColor: 'bg-destructive', testId: 'trace-danger-indicator' };
  } else if (durationMs >= 500) {
    return { barColor: 'bg-warning', testId: 'trace-slow-indicator' };
  } else if (durationMs >= 200) {
    return { barColor: 'bg-warning/70' };
  }
  return { barColor: 'bg-success' };
}

/**
 * Format timestamp from seconds to localized time string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString();
}

/**
 * Render JSON with proper formatting and syntax highlighting
 */
export function renderJson(data: unknown, indent = 0) {
  if (data === null) return <span className="text-muted-foreground">null</span>;
  if (data === undefined) return <span className="text-muted-foreground">undefined</span>;
  if (typeof data === 'string') return <span className="text-success">&quot;{data}&quot;</span>;
  if (typeof data === 'number') return <span className="text-info">{data}</span>;
  if (typeof data === 'boolean') return <span className="text-primary">{data.toString()}</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-muted-foreground">[]</span>;
    return (
      <div style={{ marginLeft: indent > 0 ? '1rem' : 0 }}>
        {data.map((item, idx) => (
          <div key={idx} className="flex">
            <span className="text-muted-foreground mr-2">{idx}:</span>
            {renderJson(item, indent + 1)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-muted-foreground">{'{}'}</span>;
    return (
      <div style={{ marginLeft: indent > 0 ? '1rem' : 0 }}>
        {entries.map(([key, value]) => (
          <div key={key} className="flex flex-wrap">
            <span className="text-warning mr-1">{key}:</span>
            {renderJson(value, indent + 1)}
          </div>
        ))}
      </div>
    );
  }

  return <span>{String(data)}</span>;
}

/**
 * Render Request tab content with full agent config
 */
export function renderRequestContent(
  event: ADKEvent,
  invocations: InvocationInfo[],
  agentConfig: AgentConfig | null,
  userMessage?: string
) {
  // Find the invocation that contains this event to get the user message
  const invocation = invocations.find(inv => inv.events.some(e => e.id === event.id));
  const message = userMessage || invocation?.userMessage || '';

  return (
    <div className="space-y-3">
      {/* Model */}
      <div>
        <span className="text-warning">model:</span>{' '}
        <span className="text-success">&quot;{event.modelVersion || agentConfig?.model || 'unknown'}&quot;</span>
      </div>

      {/* Config with http_options */}
      <div>
        <span className="text-warning">config:</span>
        <div className="ml-4 space-y-1">
          <div>
            <span className="text-warning">http_options:</span>
            <div className="ml-4">
              <span className="text-warning">headers:</span>
              <div className="ml-4">
                <span className="text-muted-foreground italic"># Standard headers set by ADK runtime</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Instruction */}
      {agentConfig?.instruction && (
        <div>
          <span className="text-warning">system_instruction:</span>
          <div className="ml-4">
            <span className="text-warning">parts:</span>
            <div className="ml-4">
              <span className="text-warning">- text:</span>{' '}
              <span className="text-success whitespace-pre-wrap">&quot;{agentConfig.instruction}&quot;</span>
            </div>
          </div>
        </div>
      )}

      {/* Tools - show sub_agents as transfer tools */}
      {agentConfig?.subAgents && agentConfig.subAgents.length > 0 && (
        <div>
          <span className="text-warning">tools:</span>
          <div className="ml-4">
            <span className="text-warning">function_declarations:</span>
            <div className="ml-4">
              {agentConfig.subAgents.map((subAgent, idx) => {
                const agentName = subAgent.replace('.yaml', '').replace(/_/g, ' ');
                return (
                  <div key={idx} className="mb-2">
                    <span className="text-warning">- name:</span>{' '}
                    <span className="text-success">&quot;transfer_to_{subAgent.replace('.yaml', '')}&quot;</span>
                    <div className="ml-4">
                      <span className="text-warning">description:</span>{' '}
                      <span className="text-success">&quot;Transfer conversation to {agentName}&quot;</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Contents - the user message */}
      <div>
        <span className="text-warning">contents:</span>
        <div className="ml-4">
          <span className="text-warning">- role:</span>{' '}
          <span className="text-success">&quot;user&quot;</span>
          <div className="ml-4">
            <span className="text-warning">parts:</span>
            <div className="ml-4">
              <span className="text-warning">- text:</span>{' '}
              <span className="text-success">&quot;{message}&quot;</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Process artifactDelta from ADK events
 * Extracts artifact metadata and returns array of artifacts to add/update
 */
export function processArtifactDelta(artifactDelta: Record<string, unknown>): Array<{
  filename: string;
  scope: 'session' | 'user';
  version: number;
  mimeType?: string;
  timestamp: Date;
}> {
  const artifacts: Array<{
    filename: string;
    scope: 'session' | 'user';
    version: number;
    mimeType?: string;
    timestamp: Date;
  }> = [];

  // artifactDelta is a map of filename to artifact metadata
  for (const [filename, metadata] of Object.entries(artifactDelta)) {
    // Determine scope from filename prefix
    const scope: 'session' | 'user' = filename.startsWith('user:') ? 'user' : 'session';

    // Extract version from metadata if available, default to 1
    let version = 1;
    let mimeType: string | undefined;

    if (metadata && typeof metadata === 'object') {
      const metadataObj = metadata as Record<string, unknown>;
      if (typeof metadataObj.version === 'number') {
        version = metadataObj.version;
      }
      if (typeof metadataObj.mimeType === 'string') {
        mimeType = metadataObj.mimeType;
      } else if (typeof metadataObj.mime_type === 'string') {
        mimeType = metadataObj.mime_type;
      }
    }

    artifacts.push({
      filename,
      scope,
      version,
      mimeType,
      timestamp: new Date(),
    });
  }

  return artifacts;
}
