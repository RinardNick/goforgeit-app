/**
 * EventsPanel Component
 *
 * Displays the list of ADK events with filtering (all/messages/tools),
 * event details view with tabs (Event/Request/Response), and formatted JSON display.
 */

import type { ADKEvent, ADKEventPart, EventFilter, DetailTab, InvocationInfo, AgentConfig } from '../types';
import { formatTimestamp, renderJson, renderRequestContent } from '../utils';

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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Filter Buttons */}
      <div className="flex-shrink-0 p-3 border-b border-gray-100 bg-gray-50">
        <div className="flex gap-1">
          <button
            data-testid="filter-all"
            data-active={eventFilter === 'all'}
            onClick={() => setEventFilter('all')}
            className={`px-2 py-1 text-xs rounded ${
              eventFilter === 'all' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All ({events.length})
          </button>
          <button
            data-testid="filter-messages"
            data-active={eventFilter === 'messages'}
            onClick={() => setEventFilter('messages')}
            className={`px-2 py-1 text-xs rounded ${
              eventFilter === 'messages' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Messages
          </button>
          <button
            data-testid="filter-tools"
            data-active={eventFilter === 'tools'}
            onClick={() => setEventFilter('tools')}
            className={`px-2 py-1 text-xs rounded ${
              eventFilter === 'tools' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Tools
          </button>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div data-testid="events-empty-state" className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <p className="text-sm text-gray-500 font-medium">No events yet</p>
        </div>
      ) : selectedEventIndex !== null && filteredEvents[selectedEventIndex] ? (
        /* Event Detail View */
        <div className="flex-1 flex flex-col overflow-hidden p-3">
          <div className="flex-shrink-0">
            <button
              onClick={() => setSelectedEventIndex(null)}
              className="mb-3 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              ← Back to list
            </button>

            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-900">
                Event {selectedEventIndex + 1} of {filteredEvents.length}
              </span>
              <span className="text-xs text-gray-500">
                {formatTimestamp(filteredEvents[selectedEventIndex].timestamp)}
              </span>
            </div>

            {/* Agent badges */}
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                🤖 {filteredEvents[selectedEventIndex].author}
              </span>
              {filteredEvents[selectedEventIndex].actions?.transferToAgent && (
                <>
                  <span className="text-gray-400">→</span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                    🤖 {filteredEvents[selectedEventIndex].actions?.transferToAgent}
                  </span>
                </>
              )}
            </div>

            {/* Detail tabs */}
            <div className="flex border-b border-gray-200 mb-3">
              <button
                onClick={() => setDetailTab('event')}
                className={`px-3 py-2 text-xs font-medium border-b-2 ${
                  detailTab === 'event' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
                }`}
              >
                Event
              </button>
              <button
                onClick={() => setDetailTab('request')}
                className={`px-3 py-2 text-xs font-medium border-b-2 ${
                  detailTab === 'request' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
                }`}
              >
                Request
              </button>
              <button
                onClick={() => setDetailTab('response')}
                className={`px-3 py-2 text-xs font-medium border-b-2 ${
                  detailTab === 'response' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
                }`}
              >
                Response
              </button>
            </div>
          </div>

          {/* Event detail content - scrollable area that fills remaining space */}
          <div data-testid="event-details" className="flex-1 min-h-0 text-xs font-mono overflow-auto bg-gray-50 rounded-lg p-3">
            {detailTab === 'event' && renderJson(filteredEvents[selectedEventIndex])}
            {detailTab === 'request' && renderRequestContent(filteredEvents[selectedEventIndex], invocations, agentConfig)}
            {detailTab === 'response' && (
              <div className="space-y-1">
                {filteredEvents[selectedEventIndex].modelVersion && (
                  <div><span className="text-amber-600">model_version:</span> <span className="text-green-600">&quot;{filteredEvents[selectedEventIndex].modelVersion}&quot;</span></div>
                )}
                {filteredEvents[selectedEventIndex].content?.parts?.[0]?.text && (
                  <div className="mt-2">
                    <span className="text-amber-600">text:</span>
                    <div className="text-green-600 ml-2 whitespace-pre-wrap">&quot;{filteredEvents[selectedEventIndex].content?.parts?.[0]?.text}&quot;</div>
                  </div>
                )}
                {filteredEvents[selectedEventIndex].usageMetadata && (
                  <div className="mt-2">
                    <span className="text-amber-600">usage_metadata:</span>
                    <div className="ml-2">{renderJson(filteredEvents[selectedEventIndex].usageMetadata)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Events List */
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {filteredEvents.map((event, index) => {
            const funcCall = event.content?.parts?.find((p: ADKEventPart) => p.functionCall)?.functionCall;
            const funcResp = event.content?.parts?.find((p: ADKEventPart) => p.functionResponse)?.functionResponse;

            return (
              <div
                key={event.id}
                data-testid={event.eventType === 'functionCall' ? 'event-tool-call' : 'event-item'}
                className="group bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors relative"
                onClick={() => setSelectedEventIndex(index)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono">{index}</span>
                    <span
                      data-testid={event.eventType === 'functionCall' || event.eventType === 'functionResponse' ? 'tool-name' : undefined}
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        event.eventType === 'functionCall' ? 'bg-orange-100 text-orange-700' :
                        event.eventType === 'functionResponse' ? 'bg-green-100 text-green-700' :
                        'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {event.eventType === 'functionCall' ? funcCall?.name :
                       event.eventType === 'functionResponse' ? funcResp?.name :
                       event.author}
                    </span>
                  </div>
                  <span data-testid="event-timestamp" className="text-xs text-gray-400">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
                <div data-testid="event-author" className="text-xs text-gray-500 truncate">
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
