/**
 * TracePanel Component
 *
 * Displays execution trace with hierarchical view of invocations, agents, and events.
 * Shows timing bars with heatmap colors, event details with tabs, and raw JSON toggle.
 */

import type { ADKEvent, ADKEventPart, DetailTab, InvocationInfo, AgentConfig } from './types';
import { getHeatmapColor, formatTimestamp, renderJson, renderRequestContent } from './utils';

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
    <div className="flex-1 overflow-y-auto bg-background">
      {/* Streaming Indicator - Shows when loading/streaming */}
      {isLoading && (
        <div data-testid="trace-streaming-indicator" className="p-3 border-b border-border">
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-sm animate-pulse border border-primary/20">
            <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
            <span className="text-xs text-primary font-bold uppercase tracking-widest font-mono">Processing...</span>
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-[streaming_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
            </div>
          </div>
        </div>
      )}
      {invocations.length === 0 && !isLoading ? (
        <div data-testid="events-empty-state" className="flex flex-col items-center justify-center h-full text-center p-4">
          <svg className="w-12 h-12 text-muted-foreground/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm text-muted-foreground font-medium">No trace yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Send a message to see the execution trace</p>
        </div>
      ) : invocations.length > 0 ? (
        <div data-testid="trace-view-panel" className="p-3 space-y-4">
          <div className="text-[10px] font-bold text-muted-foreground/60 mb-2 uppercase tracking-widest font-mono">Invocations</div>

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
                <div className="text-sm font-bold font-heading text-foreground mb-1 truncate uppercase tracking-tight">
                  {invocation.userMessage}
                </div>
                <div className="text-[10px] text-muted-foreground/60 mb-3 font-mono">
                  ID: <span className="opacity-80">{invocation.invocationId}</span>
                </div>

                {/* Main invocation row with full time bar and heatmap */}
                {(() => {
                  const heatmap = getHeatmapColor(invocationTime);
                  return (
                    <div className="flex items-center gap-2 py-1.5 px-2 bg-primary/5 rounded-sm border border-primary/10">
                      <span className="text-sm">🚀</span>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider font-mono">invocation</span>
                      <div
                        data-testid="trace-timing-bar"
                        className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"
                      >
                        <div
                          className={`h-full rounded-full ${heatmap.barColor}`}
                          data-testid={heatmap.testId}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <span className="text-[10px] text-primary font-mono flex-shrink-0">{invocationTime.toFixed(2)}ms</span>
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
                    <div key={`${agentGroup.agent}-${groupIndex}`} className="ml-4 space-y-1 mt-2">
                      {/* Agent invoke row with heatmap */}
                      <div className="flex items-center gap-2 py-1 px-2 bg-muted/30 border border-border rounded-sm">
                        <span className="text-xs opacity-70">🏃</span>
                        <span className="text-[10px] font-bold text-foreground/80 uppercase tracking-wide font-mono flex-shrink-0">{agentGroup.agent}</span>
                        <div
                          data-testid="trace-timing-bar"
                          className="flex-1 h-1 bg-muted rounded-full overflow-hidden"
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
                        <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{groupDuration.toFixed(2)}ms</span>
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
                              className={`w-full flex items-center gap-2 py-1 px-2 rounded-sm text-left transition-all duration-200 border ${
                                isSelected
                                  ? 'bg-primary/10 border-primary shadow-sm'
                                  : isToolCall
                                  ? 'bg-primary/5 border-primary/10 hover:border-primary/30'
                                  : isToolResponse
                                  ? 'bg-success/5 border-success/10 hover:border-success/30'
                                  : 'bg-muted/20 border-border hover:bg-accent'
                              }`}
                            >
                              <span className="text-xs opacity-70">
                                {isToolCall ? '⚡' : isToolResponse ? '✓' : '💬'}
                              </span>
                              <span className={`text-[10px] font-mono font-medium flex-shrink-0 uppercase tracking-tight ${
                                isToolCall ? 'text-primary' :
                                isToolResponse ? 'text-success' :
                                'text-foreground/70'
                              }`}>
                                {isToolCall ? `tool_call ${funcCall?.name}` :
                                 isToolResponse ? `tool_resp ${funcResp?.name}` :
                                 `llm_invoke`}
                              </span>
                              <div className="flex-1 h-1 bg-muted/50 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    isToolCall ? 'bg-primary' :
                                    isToolResponse ? 'bg-success' :
                                    'bg-foreground/20'
                                  }`}
                                  style={{
                                    width: `${Math.min(Math.max(eventWidthPercent, 2), 100)}%`,
                                    marginLeft: `${Math.min(eventOffsetPercent, 98)}%`
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0 opacity-60">
                                {eventDuration.toFixed(2)}ms
                              </span>
                            </button>

                            {/* Transfer indicator */}
                            {event.actions?.transferToAgent && (
                              <div className="ml-6 mt-1 text-[10px] text-primary/70 flex items-center gap-1 font-mono uppercase tracking-tighter">
                                <span>→</span>
                                <span>transfer to {event.actions.transferToAgent}</span>
                              </div>
                            )}

                            {/* Expanded event details */}
                            {isSelected && (
                              <div className="ml-6 mt-2 mb-2 p-4 bg-card border border-border rounded-sm shadow-xl relative z-10">
                                {/* Detail tabs */}
                                <div className="flex border-b border-border mb-4">
                                  {(['event', 'request', 'response'] as DetailTab[]).map((tab) => (
                                    <button
                                      key={tab}
                                      onClick={() => setDetailTab(tab)}
                                      className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest border-b-2 transition-all duration-200 ${
                                        detailTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                                      }`}
                                    >
                                      {tab}
                                    </button>
                                  ))}
                                </div>

                                {/* Agent badges */}
                                <div className="flex items-center gap-2 mb-4">
                                  <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wide">
                                    {event.author}
                                  </span>
                                  {event.actions?.transferToAgent && (
                                    <>
                                      <span className="text-muted-foreground/40">→</span>
                                      <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wide">
                                        {event.actions.transferToAgent}
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* Detail content */}
                                <div data-testid="event-details" className="text-xs font-mono overflow-auto bg-muted/30 border border-border rounded-sm p-3 max-h-96 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                                  {detailTab === 'event' && (
                                    <div className="space-y-1.5">
                                      {event.modelVersion && (
                                        <div className="flex gap-2"><span className="text-primary/60 uppercase">modelVersion:</span> <span className="text-foreground font-medium">&quot;{event.modelVersion}&quot;</span></div>
                                      )}
                                      <div className="flex gap-2"><span className="text-primary/60 uppercase">author:</span> <span className="text-foreground font-medium">&quot;{event.author}&quot;</span></div>
                                      <div className="flex gap-2"><span className="text-primary/60 uppercase">invocationId:</span> <span className="text-foreground font-medium">&quot;{event.invocationId}&quot;</span></div>
                                      {event.content?.parts?.[0]?.text && (
                                        <div className="mt-3">
                                          <span className="text-primary/60 uppercase block mb-1">text:</span>
                                          <div className="text-foreground/90 bg-background/50 p-2 rounded-sm border border-border whitespace-pre-wrap leading-relaxed">&quot;{event.content.parts[0].text}&quot;</div>
                                        </div>
                                      )}
                                      {event.usageMetadata && (
                                        <div className="mt-3">
                                          <span className="text-primary/60 uppercase block mb-1">usageMetadata:</span>
                                          <div className="p-2 bg-background/50 rounded-sm border border-border">{renderJson(event.usageMetadata)}</div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {detailTab === 'request' && renderRequestContent(event, invocations, agentConfig, invocation.userMessage)}
                                  {detailTab === 'response' && (
                                    <div className="space-y-1.5">
                                      {event.modelVersion && (
                                        <div className="flex gap-2"><span className="text-primary/60 uppercase">model_version:</span> <span className="text-foreground font-medium">&quot;{event.modelVersion}&quot;</span></div>
                                      )}
                                      {event.content?.parts?.[0]?.text && (
                                        <div className="mt-3">
                                          <span className="text-primary/60 uppercase block mb-1">text:</span>
                                          <div className="text-foreground/90 bg-background/50 p-2 rounded-sm border border-border whitespace-pre-wrap leading-relaxed">&quot;{event.content.parts[0].text}&quot;</div>
                                        </div>
                                      )}
                                      {event.finishReason && (
                                        <div className="flex gap-2"><span className="text-primary/60 uppercase">finish_reason:</span> <span className="text-foreground font-medium">&quot;{event.finishReason}&quot;</span></div>
                                      )}
                                      {event.usageMetadata && (
                                        <div className="mt-3">
                                          <span className="text-primary/60 uppercase block mb-1">usage_metadata:</span>
                                          <div className="p-2 bg-background/50 rounded-sm border border-border">{renderJson(event.usageMetadata)}</div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Raw JSON toggle */}
                                <div className="mt-4 pt-3 border-t border-border">
                                  <button
                                    data-testid="toggle-raw-json"
                                    onClick={() => setShowRawJson(!showRawJson)}
                                    className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
                                  >
                                    <svg className={`w-3 h-3 transition-transform ${showRawJson ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    {showRawJson ? 'Hide' : 'Show'} Raw Data
                                  </button>
                                  {showRawJson && (
                                    <div data-testid="raw-json-content" className="mt-3 p-3 bg-muted border border-border rounded-sm text-[10px] font-mono text-muted-foreground overflow-auto max-h-60 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                                      {JSON.stringify(event, null, 2)}
                                    </div>
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
                  <div className="border-b border-border my-6 opacity-50" />
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
