/**
 * TracePanel Component
 *
 * Displays execution trace with hierarchical view of invocations, agents, and events.
 * Shows timing bars with heatmap colors, event details with tabs, and raw JSON toggle.
 */

import type { ADKEvent, ADKEventPart, DetailTab, InvocationInfo, AgentConfig } from '../types';
import { getHeatmapColor, formatTimestamp, renderJson, renderRequestContent } from '../utils';

interface TracePanelProps {
  isLoading: boolean;
  invocations: InvocationInfo[];
  selectedEventIndex: number | null;
  setSelectedEventIndex: (index: number | null) => void;
  detailTab: DetailTab;
  setDetailTab: (tab: DetailTab) => void;
  showRawJson: boolean;
  setShowRawJson: (show: boolean) => void;
  agentConfig: AgentConfig | null;
}

export function TracePanel({
  isLoading,
  invocations,
  selectedEventIndex,
  setSelectedEventIndex,
  detailTab,
  setDetailTab,
  showRawJson,
  setShowRawJson,
  agentConfig,
}: TracePanelProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Streaming Indicator - Shows when loading/streaming */}
      {isLoading && (
        <div data-testid="trace-streaming-indicator" className="p-3 border-b border-gray-100">
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg animate-pulse">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
            <span className="text-sm text-blue-700 font-medium">Processing...</span>
            <div className="flex-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full animate-[streaming_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
            </div>
          </div>
        </div>
      )}
      {invocations.length === 0 && !isLoading ? (
        <div data-testid="events-empty-state" className="flex flex-col items-center justify-center h-full text-center p-4">
          <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm text-gray-500 font-medium">No trace yet</p>
          <p className="text-xs text-gray-400 mt-1">Send a message to see the execution trace</p>
        </div>
      ) : invocations.length > 0 ? (
        <div data-testid="trace-view-panel" className="p-3 space-y-4">
          <div className="text-xs font-medium text-gray-600 mb-2">Invocations</div>

          {/* Invocations grouped by user message */}
          {invocations.map((invocation, invIndex) => {
            // Calculate timing info for this invocation
            const invocationTime = invocation.totalTime || 0;
            const firstEventTime = invocation.events[0]?.timestamp || 0;

            // Group events by agent to create hierarchy
            const eventsByAgent: { agent: string; events: ADKEvent[]; startTime: number; endTime: number }[] = [];
            let currentAgent = '';

            invocation.events.forEach((event) => {
              const eventAgent = event.author;
              if (eventAgent !== currentAgent) {
                currentAgent = eventAgent;
                eventsByAgent.push({
                  agent: eventAgent,
                  events: [event],
                  startTime: event.timestamp,
                  endTime: event.timestamp,
                });
              } else {
                const lastGroup = eventsByAgent[eventsByAgent.length - 1];
                lastGroup.events.push(event);
                lastGroup.endTime = event.timestamp;
              }
            });

            return (
              <div key={invocation.invocationId} className="space-y-1">
                {/* User Message Header */}
                <div className="text-sm font-medium text-gray-800 mb-2 truncate">
                  {invocation.userMessage}
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  Invocation ID: <span className="font-mono">{invocation.invocationId}</span>
                </div>

                {/* Main invocation row with full time bar and heatmap */}
                {(() => {
                  const heatmap = getHeatmapColor(invocationTime);
                  return (
                    <div className="flex items-center gap-2 py-1.5 px-2 bg-blue-50 rounded">
                      <span className="text-sm">🚀</span>
                      <span className="text-xs font-medium text-blue-700 flex-shrink-0">invocation</span>
                      <div
                        data-testid="trace-timing-bar"
                        className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"
                      >
                        <div
                          className={`h-full rounded-full ${heatmap.barColor}`}
                          data-testid={heatmap.testId}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <span className="text-xs text-blue-600 font-mono flex-shrink-0">{invocationTime.toFixed(2)}ms</span>
                    </div>
                  );
                })()}

                {/* Events with hierarchy */}
                {eventsByAgent.map((agentGroup, groupIndex) => {
                  // Calculate time offset for this agent group
                  const groupStartOffset = (agentGroup.startTime - firstEventTime) * 1000;
                  const groupDuration = ((agentGroup.endTime - agentGroup.startTime) * 1000) || invocationTime;
                  const groupOffsetPercent = invocationTime > 0 ? (groupStartOffset / invocationTime) * 100 : 0;
                  const groupWidthPercent = invocationTime > 0 ? (groupDuration / invocationTime) * 100 : 100;

                  const groupHeatmap = getHeatmapColor(groupDuration);
                  return (
                    <div key={`${agentGroup.agent}-${groupIndex}`} className="ml-4 space-y-1">
                      {/* Agent invoke row with heatmap */}
                      <div className="flex items-center gap-2 py-1.5 px-2 bg-orange-50 rounded">
                        <span className="text-sm">🏃</span>
                        <span className="text-xs font-medium text-orange-700 flex-shrink-0">invoke_agent {agentGroup.agent}</span>
                        <div
                          data-testid="trace-timing-bar"
                          className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"
                        >
                          <div
                            className={`h-full rounded-full ${groupHeatmap.barColor}`}
                            data-testid={groupHeatmap.testId}
                            style={{
                              width: `${Math.min(groupWidthPercent, 100)}%`,
                              marginLeft: `${Math.min(groupOffsetPercent, 100 - groupWidthPercent)}%`
                            }}
                          />
                        </div>
                        <span className="text-xs text-orange-600 font-mono flex-shrink-0">{groupDuration.toFixed(2)}ms</span>
                      </div>

                      {/* Events within this agent */}
                      {agentGroup.events.map((event, eventIndex) => {
                        const funcCall = event.content?.parts?.find((p: ADKEventPart) => p.functionCall)?.functionCall;
                        const funcResp = event.content?.parts?.find((p: ADKEventPart) => p.functionResponse)?.functionResponse;
                        const globalIndex = invocations.slice(0, invIndex).reduce((acc, inv) => acc + inv.events.length, 0) +
                          invocation.events.findIndex(e => e.id === event.id);
                        const isSelected = selectedEventIndex === globalIndex;

                        // Calculate event timing
                        const eventOffset = (event.timestamp - firstEventTime) * 1000;
                        const nextEvent = agentGroup.events[eventIndex + 1];
                        const eventDuration = nextEvent
                          ? (nextEvent.timestamp - event.timestamp) * 1000
                          : (invocationTime - eventOffset);
                        const eventOffsetPercent = invocationTime > 0 ? (eventOffset / invocationTime) * 100 : 0;
                        const eventWidthPercent = invocationTime > 0 ? (Math.max(eventDuration, 0.1) / invocationTime) * 100 : 10;

                        // Determine event type and styling
                        const isToolCall = event.eventType === 'functionCall';
                        const isToolResponse = event.eventType === 'functionResponse';
                        const isLLMCall = event.eventType === 'text';

                        return (
                          <div key={event.id} className="ml-4">
                            <button
                              data-testid={`trace-node-${isLLMCall ? 'response' : 'tool'}`}
                              onClick={() => setSelectedEventIndex(isSelected ? null : globalIndex)}
                              className={`w-full flex items-center gap-2 py-1.5 px-2 rounded text-left transition-colors ${
                                isSelected
                                  ? 'bg-blue-100 ring-2 ring-blue-500'
                                  : isToolCall
                                  ? 'bg-purple-50 hover:bg-purple-100'
                                  : isToolResponse
                                  ? 'bg-green-50 hover:bg-green-100'
                                  : 'bg-gray-50 hover:bg-gray-100'
                              }`}
                            >
                              <span className="text-sm">
                                {isToolCall ? '⚡' : isToolResponse ? '✓' : '💬'}
                              </span>
                              <span className={`text-xs font-medium flex-shrink-0 ${
                                isToolCall ? 'text-purple-700' :
                                isToolResponse ? 'text-green-700' :
                                'text-gray-700'
                              }`}>
                                {isToolCall ? `execute_tool ${funcCall?.name}` :
                                 isToolResponse ? `tool_response ${funcResp?.name}` :
                                 `call_llm`}
                              </span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    isToolCall ? 'bg-purple-400' :
                                    isToolResponse ? 'bg-green-400' :
                                    'bg-gray-400'
                                  }`}
                                  style={{
                                    width: `${Math.min(Math.max(eventWidthPercent, 2), 100)}%`,
                                    marginLeft: `${Math.min(eventOffsetPercent, 98)}%`
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 font-mono flex-shrink-0">
                                {eventDuration.toFixed(2)}ms
                              </span>
                            </button>

                            {/* Transfer indicator */}
                            {event.actions?.transferToAgent && (
                              <div className="ml-6 mt-1 text-xs text-purple-600 flex items-center gap-1">
                                <span>→</span>
                                <span>transfer to {event.actions.transferToAgent}</span>
                              </div>
                            )}

                            {/* Expanded event details */}
                            {isSelected && (
                              <div className="ml-6 mt-2 mb-2 p-3 bg-white border border-gray-200 rounded-lg">
                                {/* Detail tabs */}
                                <div className="flex border-b border-gray-200 mb-3">
                                  <button
                                    onClick={() => setDetailTab('event')}
                                    className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                                      detailTab === 'event' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
                                    }`}
                                  >
                                    Event
                                  </button>
                                  <button
                                    onClick={() => setDetailTab('request')}
                                    className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                                      detailTab === 'request' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
                                    }`}
                                  >
                                    Request
                                  </button>
                                  <button
                                    onClick={() => setDetailTab('response')}
                                    className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                                      detailTab === 'response' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
                                    }`}
                                  >
                                    Response
                                  </button>
                                </div>

                                {/* Agent badges */}
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                    🤖 {event.author}
                                  </span>
                                  {event.actions?.transferToAgent && (
                                    <>
                                      <span className="text-gray-400">→</span>
                                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                        🤖 {event.actions.transferToAgent}
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* Detail content */}
                                <div data-testid="event-details" className="text-xs font-mono overflow-auto bg-gray-50 rounded p-2">
                                  {detailTab === 'event' && (
                                    <div className="space-y-1">
                                      {event.modelVersion && (
                                        <div><span className="text-amber-600">modelVersion:</span> <span className="text-green-600">&quot;{event.modelVersion}&quot;</span></div>
                                      )}
                                      <div><span className="text-amber-600">author:</span> <span className="text-green-600">&quot;{event.author}&quot;</span></div>
                                      <div><span className="text-amber-600">invocationId:</span> <span className="text-green-600">&quot;{event.invocationId}&quot;</span></div>
                                      {event.content?.parts?.[0]?.text && (
                                        <div className="mt-2">
                                          <span className="text-amber-600">text:</span>
                                          <div className="text-green-600 ml-2 whitespace-pre-wrap">&quot;{event.content.parts[0].text}&quot;</div>
                                        </div>
                                      )}
                                      {event.usageMetadata && (
                                        <div className="mt-2">
                                          <span className="text-amber-600">usageMetadata:</span>
                                          <div className="ml-2">{renderJson(event.usageMetadata)}</div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {detailTab === 'request' && renderRequestContent(event, invocations, agentConfig, invocation.userMessage)}
                                  {detailTab === 'response' && (
                                    <div className="space-y-1">
                                      {event.modelVersion && (
                                        <div><span className="text-amber-600">model_version:</span> <span className="text-green-600">&quot;{event.modelVersion}&quot;</span></div>
                                      )}
                                      {event.content?.parts?.[0]?.text && (
                                        <div className="mt-2">
                                          <span className="text-amber-600">text:</span>
                                          <div className="text-green-600 ml-2 whitespace-pre-wrap">&quot;{event.content.parts[0].text}&quot;</div>
                                        </div>
                                      )}
                                      {event.finishReason && (
                                        <div><span className="text-amber-600">finish_reason:</span> <span className="text-green-600">&quot;{event.finishReason}&quot;</span></div>
                                      )}
                                      {event.usageMetadata && (
                                        <div className="mt-2">
                                          <span className="text-amber-600">usage_metadata:</span>
                                          <div className="ml-2">{renderJson(event.usageMetadata)}</div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Raw JSON toggle */}
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <button
                                    data-testid="toggle-raw-json"
                                    onClick={() => setShowRawJson(!showRawJson)}
                                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                  >
                                    <svg className={`w-3 h-3 transition-transform ${showRawJson ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    {showRawJson ? 'Hide' : 'Show'} Raw JSON
                                  </button>
                                  {showRawJson && (
                                    <pre data-testid="raw-json-content" className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                                      {JSON.stringify(event, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Separator between invocations */}
                {invIndex < invocations.length - 1 && (
                  <div className="border-b border-gray-200 my-4" />
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
