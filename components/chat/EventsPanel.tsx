/**
 * EventsPanel Component
 *
 * Displays the list of ADK events with filtering (all/messages/tools),
 * event details view with tabs (Event/Request/Response), and formatted JSON display.
 */

import type { ADKEvent, ADKEventPart, EventFilter, DetailTab, InvocationInfo, AgentConfig } from './types';
import { formatTimestamp, renderJson, renderRequestContent } from './utils';

interface EventsPanelProps {
  events: ADKEvent[];
  eventFilter: EventFilter;
  setEventFilter: (filter: EventFilter) => void;
  filteredEvents: ADKEvent[];
  selectedEventIndex: number | null;
  setSelectedEventIndex: (index: number | null) => void;
  detailTab: DetailTab;
  setDetailTab: (tab: DetailTab) => void;
  invocations: InvocationInfo[];
  agentConfig: AgentConfig | null;
}

export function EventsPanel({
  events,
  eventFilter,
  setEventFilter,
  filteredEvents,
  selectedEventIndex,
  setSelectedEventIndex,
  detailTab,
  setDetailTab,
  invocations,
  agentConfig,
}: EventsPanelProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Filter Buttons */}
      <div className="flex-shrink-0 p-3 border-b border-border bg-muted/30">
        <div className="flex gap-1">
          <button
            data-testid="filter-all"
            data-active={eventFilter === 'all'}
            onClick={() => setEventFilter('all')}
            className={`px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-sm transition-all ${
              eventFilter === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            All ({events.length})
          </button>
          <button
            data-testid="filter-messages"
            data-active={eventFilter === 'messages'}
            onClick={() => setEventFilter('messages')}
            className={`px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-sm transition-all ${
              eventFilter === 'messages' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            Messages
          </button>
          <button
            data-testid="filter-tools"
            data-active={eventFilter === 'tools'}
            onClick={() => setEventFilter('tools')}
            className={`px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-sm transition-all ${
              eventFilter === 'tools' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            Tools
          </button>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div data-testid="events-empty-state" className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <p className="text-sm text-muted-foreground font-medium">No events yet</p>
        </div>
      ) : selectedEventIndex !== null && filteredEvents[selectedEventIndex] ? (
        /* Event Detail View */
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <div className="flex-shrink-0">
            <button
              onClick={() => setSelectedEventIndex(null)}
              className="mb-4 text-[10px] font-mono font-bold uppercase tracking-widest text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              ← Back to list
            </button>

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-heading font-bold text-foreground uppercase tracking-tight">
                Event {selectedEventIndex + 1} of {filteredEvents.length}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/60">
                {formatTimestamp(filteredEvents[selectedEventIndex].timestamp)}
              </span>
            </div>

            {/* Agent badges */}
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wide">
                {filteredEvents[selectedEventIndex].author}
              </span>
              {filteredEvents[selectedEventIndex].actions?.transferToAgent && (
                <>
                  <span className="text-muted-foreground/40">→</span>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wide">
                    {filteredEvents[selectedEventIndex].actions?.transferToAgent}
                  </span>
                </>
              )}
            </div>

            {/* Detail tabs */}
            <div className="flex border-b border-border mb-4">
              {(['event', 'request', 'response'] as DetailTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={`px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-widest border-b-2 transition-all duration-200 ${
                    detailTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Event detail content */}
          <div data-testid="event-details" className="flex-1 min-h-0 text-xs font-mono overflow-auto bg-muted/30 border border-border rounded-sm p-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {detailTab === 'event' && renderJson(filteredEvents[selectedEventIndex])}
            {detailTab === 'request' && renderRequestContent(filteredEvents[selectedEventIndex], invocations, agentConfig)}
            {detailTab === 'response' && (
              <div className="space-y-1.5">
                {filteredEvents[selectedEventIndex].modelVersion && (
                  <div className="flex gap-2"><span className="text-primary/60 uppercase">model_version:</span> <span className="text-foreground font-medium">&quot;{filteredEvents[selectedEventIndex].modelVersion}&quot;</span></div>
                )}
                {filteredEvents[selectedEventIndex].content?.parts?.[0]?.text && (
                  <div className="mt-3">
                    <span className="text-primary/60 uppercase block mb-1">text:</span>
                    <div className="text-foreground/90 bg-background/50 p-2 rounded-sm border border-border whitespace-pre-wrap leading-relaxed">&quot;{filteredEvents[selectedEventIndex].content?.parts?.[0]?.text}&quot;</div>
                  </div>
                )}
                {filteredEvents[selectedEventIndex].usageMetadata && (
                  <div className="mt-3">
                    <span className="text-primary/60 uppercase block mb-1">usage_metadata:</span>
                    <div className="p-2 bg-background/50 rounded-sm border border-border">{renderJson(filteredEvents[selectedEventIndex].usageMetadata)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Events List */
        <div className="flex-1 overflow-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {filteredEvents.map((event, index) => {
            const funcCall = event.content?.parts?.find((p: ADKEventPart) => p.functionCall)?.functionCall;
            const funcResp = event.content?.parts?.find((p: ADKEventPart) => p.functionResponse)?.functionResponse;

            return (
              <div
                key={event.id}
                data-testid={event.eventType === 'functionCall' ? 'event-tool-call' : 'event-item'}
                className="group bg-card border border-border rounded-sm p-3 cursor-pointer hover:border-primary/50 transition-all relative shadow-sm"
                onClick={() => setSelectedEventIndex(index)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/40 font-mono">{index}</span>
                    <span
                      data-testid={event.eventType === 'functionCall' || event.eventType === 'functionResponse' ? 'tool-name' : undefined}
                      className={`px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wide border ${
                        event.eventType === 'functionCall' ? 'bg-primary/5 text-primary border-primary/20' :
                        event.eventType === 'functionResponse' ? 'bg-success/5 text-success border-success/20' :
                        'bg-muted text-foreground/70 border-border'
                      }`}
                    >
                      {event.eventType === 'functionCall' ? funcCall?.name :
                       event.eventType === 'functionResponse' ? funcResp?.name :
                       event.author}
                    </span>
                  </div>
                  <span data-testid="event-timestamp" className="text-[10px] text-muted-foreground/40 font-mono">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
                <div data-testid="event-author" className="text-xs text-muted-foreground truncate opacity-80 leading-relaxed font-sans">
                  {event.title}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
