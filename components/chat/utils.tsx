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
    return { barColor: 'bg-red-400', testId: 'trace-danger-indicator' };
  } else if (durationMs >= 500) {
    return { barColor: 'bg-orange-400', testId: 'trace-slow-indicator' };
  } else if (durationMs >= 200) {
    return { barColor: 'bg-yellow-400' };
  }
  return { barColor: 'bg-green-400' };
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
  if (data === null) return <span className="text-gray-500">null</span>;
  if (data === undefined) return <span className="text-gray-500">undefined</span>;
  if (typeof data === 'string') return <span className="text-green-600">&quot;{data}&quot;</span>;
  if (typeof data === 'number') return <span className="text-blue-600">{data}</span>;
  if (typeof data === 'boolean') return <span className="text-purple-600">{data.toString()}</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-gray-500">[]</span>;
    return (
      <div style={{ marginLeft: indent > 0 ? '1rem' : 0 }}>
        {data.map((item, idx) => (
          <div key={idx} className="flex">
            <span className="text-gray-400 mr-2">{idx}:</span>
            {renderJson(item, indent + 1)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-gray-500">{'{}'}</span>;
    return (
      <div style={{ marginLeft: indent > 0 ? '1rem' : 0 }}>
        {entries.map(([key, value]) => (
          <div key={key} className="flex flex-wrap">
            <span className="text-amber-600 mr-1">{key}:</span>
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
        <span className="text-amber-600">model:</span>{' '}
        <span className="text-green-600">&quot;{event.modelVersion || agentConfig?.model || 'unknown'}&quot;</span>
      </div>

      {/* Config with http_options */}
      <div>
        <span className="text-amber-600">config:</span>
        <div className="ml-4 space-y-1">
          <div>
            <span className="text-amber-600">http_options:</span>
            <div className="ml-4">
              <span className="text-amber-600">headers:</span>
              <div className="ml-4">
                <span className="text-gray-500 italic"># Standard headers set by ADK runtime</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Instruction */}
      {agentConfig?.instruction && (
        <div>
          <span className="text-amber-600">system_instruction:</span>
          <div className="ml-4">
            <span className="text-amber-600">parts:</span>
            <div className="ml-4">
              <span className="text-amber-600">- text:</span>{' '}
              <span className="text-green-600 whitespace-pre-wrap">&quot;{agentConfig.instruction}&quot;</span>
            </div>
          </div>
        </div>
      )}

      {/* Tools - show sub_agents as transfer tools */}
      {agentConfig?.subAgents && agentConfig.subAgents.length > 0 && (
        <div>
          <span className="text-amber-600">tools:</span>
          <div className="ml-4">
            <span className="text-amber-600">function_declarations:</span>
            <div className="ml-4">
              {agentConfig.subAgents.map((subAgent, idx) => {
                const agentName = subAgent.replace('.yaml', '').replace(/_/g, ' ');
                return (
                  <div key={idx} className="mb-2">
                    <span className="text-amber-600">- name:</span>{' '}
                    <span className="text-green-600">&quot;transfer_to_{subAgent.replace('.yaml', '')}&quot;</span>
                    <div className="ml-4">
                      <span className="text-amber-600">description:</span>{' '}
                      <span className="text-green-600">&quot;Transfer conversation to {agentName}&quot;</span>
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
        <span className="text-amber-600">contents:</span>
        <div className="ml-4">
          <span className="text-amber-600">- role:</span>{' '}
          <span className="text-green-600">&quot;user&quot;</span>
          <div className="ml-4">
            <span className="text-amber-600">parts:</span>
            <div className="ml-4">
              <span className="text-amber-600">- text:</span>{' '}
              <span className="text-green-600">&quot;{message}&quot;</span>
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
