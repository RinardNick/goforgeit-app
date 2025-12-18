'use client';

import { EvalRun } from '@/lib/adk/evaluation-types';

export interface RunComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  runs: EvalRun[];
  selectedRunsForComparison: number[];
}

export function RunComparisonModal({
  isOpen,
  onClose,
  runs,
  selectedRunsForComparison,
}: RunComparisonModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div data-testid="comparison-view" className="bg-card rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Run Comparison</h2>
          <button
            data-testid="close-comparison-btn"
            onClick={onClose}
            className="text-gray-400 hover:text-muted-foreground"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Metrics Comparison Table */}
        <div data-testid="metrics-comparison-table" className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left p-3 font-semibold text-foreground">Metric</th>
                {selectedRunsForComparison.map((runIndex, colIdx) => (
                  <th key={runIndex} data-testid={`comparison-run-column-${colIdx}`} className="text-left p-3 font-semibold text-foreground">
                    Run {runIndex + 1}
                    <div className="text-xs font-normal text-muted-foreground">
                      {new Date(runs[runIndex].timestamp).toLocaleString()}
                    </div>
                  </th>
                ))}
                {selectedRunsForComparison.length >= 2 && (
                  <th className="text-left p-3 font-semibold text-foreground">Change</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Collect all unique metrics across selected runs
                const allMetrics = new Set<string>();
                selectedRunsForComparison.forEach(runIndex => {
                  const run = runs[runIndex];
                  if (run.metrics_summary) {
                    Object.keys(run.metrics_summary).forEach(m => allMetrics.add(m));
                  }
                });

                // If no metrics, show synthetic response_match_score
                if (allMetrics.size === 0) {
                  allMetrics.add('response_match_score');
                }

                return Array.from(allMetrics).map(metricName => {
                  const displayNames: Record<string, string> = {
                    'response_match_score': 'Response Match',
                    'tool_trajectory_avg_score': 'Tool Trajectory',
                    'final_response_match_v2': 'Semantic Match',
                  };

                  const metricValues = selectedRunsForComparison.map(runIndex => {
                    const run = runs[runIndex];
                    let metricData = (run.metrics_summary as Record<string, any>)?.[metricName];

                    // Generate synthetic response_match_score if not present
                    if (!metricData && metricName === 'response_match_score') {
                      metricData = {
                        avg_score: (run.overall_pass_rate || 0) / 100,
                        pass_rate: run.overall_pass_rate || 0
                      };
                    }

                    return metricData;
                  });

                  // Calculate delta (comparing first to last selected run)
                  const firstValue = metricValues[0]?.avg_score || 0;
                  const lastValue = metricValues[metricValues.length - 1]?.avg_score || 0;
                  const delta = lastValue - firstValue;
                  const deltaPercent = Math.abs(delta * 100);

                  let deltaIndicator = '→';
                  let deltaColor = 'text-muted-foreground';
                  if (delta > 0.01) {
                    deltaIndicator = '↑';
                    deltaColor = 'text-green-500';
                  } else if (delta < -0.01) {
                    deltaIndicator = '↓';
                    deltaColor = 'text-destructive';
                  }

                  return (
                    <tr key={metricName} data-testid={`metric-row-${metricName}`} className="border-b border-border">
                      <td className="p-3 font-medium text-foreground">
                        {displayNames[metricName] || metricName}
                      </td>
                      {metricValues.map((metricData, colIdx) => (
                        <td key={colIdx} className="p-3">
                          {metricData ? (
                            <div>
                              <div className="text-lg font-semibold text-foreground">
                                {(metricData.avg_score * 100).toFixed(1)}%
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Pass: {Math.round(metricData.pass_rate)}%
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">N/A</span>
                          )}
                        </td>
                      ))}
                      {selectedRunsForComparison.length >= 2 && (
                        <td data-testid={`delta-cell-${metricName}`} className="p-3">
                          <div className={`flex items-center gap-1 ${deltaColor} font-semibold`}>
                            <span className="text-xl">{deltaIndicator}</span>
                            <span className="text-sm">{deltaPercent.toFixed(1)}%</span>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
