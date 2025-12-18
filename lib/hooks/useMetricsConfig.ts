'use client';

import { useState, useCallback } from 'react';
import type { MetricConfig } from '@/lib/adk/evaluation-types';

// Default metrics configuration
const DEFAULT_METRICS: MetricConfig[] = [
  {
    id: 'tool_trajectory_avg_score',
    name: 'Tool Trajectory Score',
    description: 'F1 score comparing expected vs actual tool calls',
    threshold: 1.0,
    enabled: true,
    type: 'deterministic',
  },
  {
    id: 'response_match_score',
    name: 'Response Match Score',
    description: 'ROUGE-1 similarity between expected and actual responses',
    threshold: 0.8,
    enabled: true,
    type: 'deterministic',
  },
  {
    id: 'final_response_match_v2',
    name: 'Final Response Match (LLM)',
    description: 'LLM-based semantic equivalence check',
    threshold: 0.7,
    enabled: false,
    type: 'llm',
  },
  {
    id: 'rubric_based_final_response_quality_v1',
    name: 'Response Quality (Rubric-based)',
    description: 'LLM scores response quality using custom rubric',
    threshold: 0.7,
    enabled: false,
    type: 'llm',
    supportsRubric: true,
    rubric: '',
  },
  {
    id: 'rubric_based_tool_use_quality_v1',
    name: 'Tool Use Quality (Rubric-based)',
    description: 'LLM validates tool usage against rubric',
    threshold: 0.7,
    enabled: false,
    type: 'llm',
    supportsRubric: true,
    rubric: '',
  },
  {
    id: 'hallucinations_v1',
    name: 'Hallucination Detection',
    description: 'Checks if response is grounded in context',
    threshold: 0.9,
    enabled: false,
    type: 'llm',
  },
  {
    id: 'safety_v1',
    name: 'Safety Assessment',
    description: 'Detects harmful or unsafe content',
    threshold: 0.9,
    enabled: false,
    type: 'llm',
  },
];

export interface UseMetricsConfigOptions {
  agentName: string;
  evalsetId: string;
  apiBasePath: '/api/agents' | '/api/adk-agents';
}

export interface UseMetricsConfigReturn {
  // State
  metrics: MetricConfig[];
  showMetricsConfig: boolean;
  hasCustomConfig: boolean;
  isSaving: boolean;
  saveMessage: string | null;

  // Modal control
  openMetricsConfig: () => void;
  closeMetricsConfig: () => void;

  // Metric actions
  toggleMetric: (metricId: string) => void;
  setThreshold: (metricId: string, threshold: number) => void;
  setRubric: (metricId: string, rubric: string) => void;
  applyTemplate: (template: 'strict' | 'balanced' | 'lenient') => void;

  // API actions
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
  resetConfig: () => Promise<void>;
}

/**
 * Hook for managing evaluation metrics configuration.
 * Extracts complex metrics state management from evaluation pages.
 */
export function useMetricsConfig({
  agentName,
  evalsetId,
  apiBasePath,
}: UseMetricsConfigOptions): UseMetricsConfigReturn {
  const [metrics, setMetrics] = useState<MetricConfig[]>(DEFAULT_METRICS);
  const [showMetricsConfig, setShowMetricsConfig] = useState(false);
  const [hasCustomConfig, setHasCustomConfig] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const openMetricsConfig = useCallback(() => {
    setShowMetricsConfig(true);
  }, []);

  const closeMetricsConfig = useCallback(() => {
    setShowMetricsConfig(false);
  }, []);

  const toggleMetric = useCallback((metricId: string) => {
    setMetrics((prev) => {
      const updated = prev.map((m) =>
        m.id === metricId ? { ...m, enabled: !m.enabled } : m
      );

      // Ensure at least one metric remains enabled
      const enabledCount = updated.filter((m) => m.enabled).length;
      if (enabledCount === 0) {
        return prev; // Prevent disabling the last metric
      }

      return updated;
    });
  }, []);

  const setThreshold = useCallback((metricId: string, threshold: number) => {
    setMetrics((prev) =>
      prev.map((m) => (m.id === metricId ? { ...m, threshold } : m))
    );
  }, []);

  const setRubric = useCallback((metricId: string, rubric: string) => {
    setMetrics((prev) =>
      prev.map((m) =>
        m.id === metricId && m.supportsRubric ? { ...m, rubric } : m
      )
    );
  }, []);

  const applyTemplate = useCallback((template: 'strict' | 'balanced' | 'lenient') => {
    const thresholdMap = {
      strict: 0.9,
      balanced: 0.75,
      lenient: 0.55,
    };

    const newThreshold = thresholdMap[template];

    setMetrics((prev) =>
      prev.map((m) => (m.enabled ? { ...m, threshold: newThreshold } : m))
    );
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const response = await fetch(
        `${apiBasePath}/${agentName}/evaluations/${evalsetId}/config`
      );

      if (!response.ok) {
        console.error('Failed to load config');
        return;
      }

      const data = await response.json();
      setHasCustomConfig(data.hasCustomConfig);

      if (data.hasCustomConfig && data.config?.criteria) {
        const criteria = data.config.criteria;

        setMetrics((prev) =>
          prev.map((metric) => {
            const savedMetric = criteria[metric.id];

            if (savedMetric !== undefined) {
              if (typeof savedMetric === 'number') {
                return { ...metric, enabled: true, threshold: savedMetric };
              } else if (typeof savedMetric === 'object') {
                return {
                  ...metric,
                  enabled: true,
                  threshold: savedMetric.threshold || metric.threshold,
                  rubric: savedMetric.rubric || metric.rubric || '',
                };
              }
            }
            // Metric not in saved config - disable it
            return { ...metric, enabled: false };
          })
        );
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }, [apiBasePath, agentName, evalsetId]);

  const saveConfig = useCallback(async () => {
    setIsSaving(true);
    setSaveMessage(null);

    // Build criteria object from metrics state
    const criteria: Record<string, unknown> = {};
    metrics.forEach((metric) => {
      if (metric.enabled) {
        if (metric.supportsRubric && metric.rubric) {
          criteria[metric.id] = {
            threshold: metric.threshold,
            rubric: metric.rubric,
          };
        } else {
          criteria[metric.id] = metric.threshold;
        }
      }
    });

    try {
      const response = await fetch(
        `${apiBasePath}/${agentName}/evaluations/${evalsetId}/config`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ criteria }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      setHasCustomConfig(true);
      setSaveMessage('Configuration saved');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      setSaveMessage('Error saving configuration');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [apiBasePath, agentName, evalsetId, metrics]);

  const resetConfig = useCallback(async () => {
    const confirmed = confirm(
      'This will delete your custom configuration and restore the default metrics. Are you sure?'
    );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch(
        `${apiBasePath}/${agentName}/evaluations/${evalsetId}/config`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to reset configuration');
      }

      // Reset to default metrics state
      setMetrics((prev) =>
        prev.map((metric) => {
          const isDefaultEnabled =
            metric.id === 'tool_trajectory_avg_score' ||
            metric.id === 'response_match_score';

          return {
            ...metric,
            enabled: isDefaultEnabled,
            ...(metric.supportsRubric ? { rubric: '' } : {}),
          };
        })
      );

      setHasCustomConfig(false);
      setSaveMessage('Configuration reset to defaults');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error resetting config:', error);
      setSaveMessage('Error resetting configuration');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [apiBasePath, agentName, evalsetId]);

  return {
    // State
    metrics,
    showMetricsConfig,
    hasCustomConfig,
    isSaving,
    saveMessage,

    // Modal control
    openMetricsConfig,
    closeMetricsConfig,

    // Metric actions
    toggleMetric,
    setThreshold,
    setRubric,
    applyTemplate,

    // API actions
    loadConfig,
    saveConfig,
    resetConfig,
  };
}
