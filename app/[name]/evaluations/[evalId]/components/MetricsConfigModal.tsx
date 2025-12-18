'use client';

import { MetricConfig, MetricsConfigJson } from '@/lib/adk/evaluation-types';

export interface MetricsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasCustomConfig: boolean;
  metrics: MetricConfig[];
  jsonPreview: MetricsConfigJson;
  isSaving: boolean;
  saveMessage: string | null;
  onToggleMetric: (metricId: string) => void;
  onThresholdChange: (metricId: string, value: number) => void;
  onRubricChange: (metricId: string, value: string) => void;
  onApplyTemplate: (template: 'strict' | 'balanced' | 'lenient') => void;
  onSaveConfig: () => void;
  onResetConfig: () => void;
}

export function MetricsConfigModal({
  isOpen,
  onClose,
  hasCustomConfig,
  metrics,
  jsonPreview,
  isSaving,
  saveMessage,
  onToggleMetric,
  onThresholdChange,
  onRubricChange,
  onApplyTemplate,
  onSaveConfig,
  onResetConfig,
}: MetricsConfigModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        data-testid="metrics-config-modal"
        className="bg-card rounded-xl p-6 w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-foreground">Configure Evaluation Metrics</h2>
            <span
              data-testid="config-status-badge"
              className={`px-3 py-1 text-sm rounded-full ${
                hasCustomConfig
                  ? 'bg-primary/10 text-primary'
                  : 'bg-gray-100 text-foreground'
              }`}
            >
              {hasCustomConfig ? 'Using Custom Config' : 'Using Defaults'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-muted-foreground transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Templates */}
        <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-3">Quick Templates</h3>
          <div className="flex gap-2">
            <button
              data-testid="template-strict"
              onClick={() => onApplyTemplate('strict')}
              className="px-4 py-2 text-sm font-medium text-primary bg-purple-50 border border-purple-200 rounded-lg hover:bg-primary/10 transition-colors"
            >
              Strict (0.9+)
            </button>
            <button
              data-testid="template-balanced"
              onClick={() => onApplyTemplate('balanced')}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-primary/10 border border-blue-200 rounded-lg hover:bg-primary/20 transition-colors"
            >
              Balanced (0.7-0.8)
            </button>
            <button
              data-testid="template-lenient"
              onClick={() => onApplyTemplate('lenient')}
              className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-500/10 transition-colors"
            >
              Lenient (0.5-0.6)
            </button>
          </div>
        </div>

        {/* Metrics List */}
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              data-testid={`metric-card-${metric.id}`}
              className="border border-border rounded-lg p-4 hover:border-border transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      data-testid={`metric-toggle-${metric.id}`}
                      checked={metric.enabled}
                      onChange={() => onToggleMetric(metric.id)}
                      className="w-4 h-4 text-purple-600 border-border rounded focus:ring-purple-500"
                    />
                    <h3 className="font-semibold text-foreground">{metric.name}</h3>
                    {!metric.enabled && (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-muted-foreground rounded">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-mono mb-1">{metric.id}</p>
                  <p className="text-sm text-muted-foreground">{metric.description}</p>
                </div>
              </div>

              {/* Threshold Slider (Phase 18.9.5) */}
              {metric.enabled && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor={`threshold-${metric.id}`} className="text-sm font-medium text-foreground">
                      Threshold
                    </label>
                    <span className="text-sm font-semibold text-foreground">{metric.threshold.toFixed(2)}</span>
                  </div>
                  <input
                    id={`threshold-${metric.id}`}
                    type="range"
                    data-testid={`threshold-slider-${metric.id}`}
                    min="0"
                    max="1"
                    step="0.01"
                    value={metric.threshold}
                    onChange={(e) => onThresholdChange(metric.id, parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>
              )}

              {/* Rubric Editor (Phase 18.9.6) */}
              {metric.enabled && metric.supportsRubric && (
                <div className="mt-4">
                  <label className="text-sm font-medium text-foreground">Custom Rubric</label>
                  <textarea
                    data-testid={`rubric-editor-${metric.id}`}
                    value={metric.rubric || ''}
                    onChange={(e) => onRubricChange(metric.id, e.target.value)}
                    placeholder="Write custom evaluation criteria..."
                    className="w-full mt-1 p-2 border border-border rounded-lg text-sm"
                    rows={4}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* JSON Preview (Phase 18.9.10) */}
        <div className="mt-6 border border-border rounded-lg p-4 bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground mb-2">Configuration Preview</h3>
          <pre
            data-testid="json-preview"
            className="text-xs font-mono text-gray-800 overflow-x-auto whitespace-pre-wrap break-words"
          >
            {JSON.stringify(jsonPreview, null, 2)}
          </pre>
        </div>

        {/* Save Button and Notification (Phase 18.9.7) */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-3">
            <button
              data-testid="save-config-btn"
              onClick={onSaveConfig}
              disabled={isSaving}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
            <button
              data-testid="reset-config-btn"
              onClick={onResetConfig}
              disabled={isSaving}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Reset to Defaults
            </button>
          </div>
          {saveMessage && (
            <span className={`text-sm font-medium ${
              saveMessage.includes('Error') ? 'text-destructive' : 'text-green-500'
            }`}>
              {saveMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
