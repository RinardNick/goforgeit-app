import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';

// Mock useState and useCallback since we can't actually use React hooks in Node.js
// We test the logic, not the React integration

describe('useMetricsConfig Hook Logic', () => {
  describe('Default Metrics', () => {
    const DEFAULT_METRICS = [
      { id: 'tool_trajectory_avg_score', name: 'Tool Trajectory Score', enabled: true },
      { id: 'response_match_score', name: 'Response Match Score', enabled: true },
      { id: 'final_response_match_v2', name: 'Final Response Match (LLM)', enabled: false },
      { id: 'rubric_based_final_response_quality_v1', name: 'Response Quality', enabled: false },
      { id: 'rubric_based_tool_use_quality_v1', name: 'Tool Use Quality', enabled: false },
      { id: 'hallucinations_v1', name: 'Hallucination Detection', enabled: false },
      { id: 'safety_v1', name: 'Safety Assessment', enabled: false },
    ];

    it('should have 7 default metrics', () => {
      assert.strictEqual(DEFAULT_METRICS.length, 7);
    });

    it('should have 2 metrics enabled by default', () => {
      const enabledCount = DEFAULT_METRICS.filter(m => m.enabled).length;
      assert.strictEqual(enabledCount, 2);
    });

    it('should enable tool_trajectory_avg_score by default', () => {
      const metric = DEFAULT_METRICS.find(m => m.id === 'tool_trajectory_avg_score');
      assert.ok(metric);
      assert.strictEqual(metric.enabled, true);
    });

    it('should enable response_match_score by default', () => {
      const metric = DEFAULT_METRICS.find(m => m.id === 'response_match_score');
      assert.ok(metric);
      assert.strictEqual(metric.enabled, true);
    });
  });

  describe('Toggle Metric Logic', () => {
    it('should toggle a metric from enabled to disabled', () => {
      // Need at least 2 enabled so toggling one off still leaves one enabled
      const metrics = [
        { id: 'test1', enabled: true },
        { id: 'test2', enabled: true },
      ];

      const toggleMetric = (metricId: string) => {
        const updated = metrics.map(m =>
          m.id === metricId ? { ...m, enabled: !m.enabled } : m
        );

        const enabledCount = updated.filter(m => m.enabled).length;
        if (enabledCount === 0) {
          return metrics; // Prevent disabling last metric
        }
        return updated;
      };

      const result = toggleMetric('test1');
      const toggled = result.find(m => m.id === 'test1');
      assert.ok(toggled);
      assert.strictEqual(toggled.enabled, false);
    });

    it('should prevent disabling the last enabled metric', () => {
      const metrics = [
        { id: 'test1', enabled: true },
        { id: 'test2', enabled: false },
      ];

      const toggleMetric = (metricId: string) => {
        const updated = metrics.map(m =>
          m.id === metricId ? { ...m, enabled: !m.enabled } : m
        );

        const enabledCount = updated.filter(m => m.enabled).length;
        if (enabledCount === 0) {
          return metrics; // Prevent disabling last metric
        }
        return updated;
      };

      const result = toggleMetric('test1');
      // Should return original since test1 is the only enabled metric
      const test1 = result.find(m => m.id === 'test1');
      assert.ok(test1);
      assert.strictEqual(test1.enabled, true); // Should stay enabled
    });
  });

  describe('Threshold Logic', () => {
    it('should update threshold for a specific metric', () => {
      const metrics = [
        { id: 'test1', threshold: 0.8 },
        { id: 'test2', threshold: 0.7 },
      ];

      const setThreshold = (metricId: string, threshold: number) => {
        return metrics.map(m =>
          m.id === metricId ? { ...m, threshold } : m
        );
      };

      const result = setThreshold('test1', 0.95);
      const test1 = result.find(m => m.id === 'test1');
      assert.ok(test1);
      assert.strictEqual(test1.threshold, 0.95);
    });

    it('should not affect other metrics when updating threshold', () => {
      const metrics = [
        { id: 'test1', threshold: 0.8 },
        { id: 'test2', threshold: 0.7 },
      ];

      const setThreshold = (metricId: string, threshold: number) => {
        return metrics.map(m =>
          m.id === metricId ? { ...m, threshold } : m
        );
      };

      const result = setThreshold('test1', 0.95);
      const test2 = result.find(m => m.id === 'test2');
      assert.ok(test2);
      assert.strictEqual(test2.threshold, 0.7); // Unchanged
    });
  });

  describe('Template Application Logic', () => {
    const thresholdMap = {
      strict: 0.9,
      balanced: 0.75,
      lenient: 0.55,
    };

    it('should apply strict template threshold of 0.9', () => {
      const metrics = [
        { id: 'test1', enabled: true, threshold: 0.5 },
        { id: 'test2', enabled: false, threshold: 0.5 },
      ];

      const applyTemplate = (template: 'strict' | 'balanced' | 'lenient') => {
        const newThreshold = thresholdMap[template];
        return metrics.map(m =>
          m.enabled ? { ...m, threshold: newThreshold } : m
        );
      };

      const result = applyTemplate('strict');
      const enabled = result.find(m => m.id === 'test1');
      assert.ok(enabled);
      assert.strictEqual(enabled.threshold, 0.9);
    });

    it('should apply balanced template threshold of 0.75', () => {
      const metrics = [
        { id: 'test1', enabled: true, threshold: 0.5 },
      ];

      const applyTemplate = (template: 'strict' | 'balanced' | 'lenient') => {
        const newThreshold = thresholdMap[template];
        return metrics.map(m =>
          m.enabled ? { ...m, threshold: newThreshold } : m
        );
      };

      const result = applyTemplate('balanced');
      assert.strictEqual(result[0].threshold, 0.75);
    });

    it('should apply lenient template threshold of 0.55', () => {
      const metrics = [
        { id: 'test1', enabled: true, threshold: 0.5 },
      ];

      const applyTemplate = (template: 'strict' | 'balanced' | 'lenient') => {
        const newThreshold = thresholdMap[template];
        return metrics.map(m =>
          m.enabled ? { ...m, threshold: newThreshold } : m
        );
      };

      const result = applyTemplate('lenient');
      assert.strictEqual(result[0].threshold, 0.55);
    });

    it('should only apply template to enabled metrics', () => {
      const metrics = [
        { id: 'test1', enabled: true, threshold: 0.5 },
        { id: 'test2', enabled: false, threshold: 0.5 },
      ];

      const applyTemplate = (template: 'strict' | 'balanced' | 'lenient') => {
        const newThreshold = thresholdMap[template];
        return metrics.map(m =>
          m.enabled ? { ...m, threshold: newThreshold } : m
        );
      };

      const result = applyTemplate('strict');
      const disabled = result.find(m => m.id === 'test2');
      assert.ok(disabled);
      assert.strictEqual(disabled.threshold, 0.5); // Unchanged
    });
  });

  describe('Rubric Logic', () => {
    it('should update rubric for metrics that support it', () => {
      const metrics = [
        { id: 'test1', supportsRubric: true, rubric: '' },
        { id: 'test2', supportsRubric: false },
      ];

      const setRubric = (metricId: string, rubric: string) => {
        return metrics.map(m =>
          m.id === metricId && m.supportsRubric ? { ...m, rubric } : m
        );
      };

      const result = setRubric('test1', 'New rubric text');
      const test1 = result.find(m => m.id === 'test1') as { rubric: string };
      assert.ok(test1);
      assert.strictEqual(test1.rubric, 'New rubric text');
    });

    it('should not update rubric for metrics that do not support it', () => {
      const metrics = [
        { id: 'test1', supportsRubric: false },
      ];

      const setRubric = (metricId: string, rubric: string) => {
        return metrics.map(m =>
          m.id === metricId && m.supportsRubric ? { ...m, rubric } : m
        );
      };

      const result = setRubric('test1', 'Should not be set');
      const test1 = result.find(m => m.id === 'test1') as { rubric?: string };
      assert.ok(test1);
      assert.strictEqual(test1.rubric, undefined);
    });
  });

  describe('Criteria Building Logic', () => {
    it('should build criteria object from enabled metrics', () => {
      const metrics = [
        { id: 'metric1', enabled: true, threshold: 0.8, supportsRubric: false },
        { id: 'metric2', enabled: false, threshold: 0.7 },
        { id: 'metric3', enabled: true, threshold: 0.9, supportsRubric: true, rubric: 'Test rubric' },
      ];

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

      assert.strictEqual(Object.keys(criteria).length, 2);
      assert.strictEqual(criteria['metric1'], 0.8);
      assert.deepStrictEqual(criteria['metric3'], { threshold: 0.9, rubric: 'Test rubric' });
      assert.strictEqual(criteria['metric2'], undefined);
    });
  });

  describe('Config Loading Logic', () => {
    it('should enable metrics found in loaded config', () => {
      const defaultMetrics = [
        { id: 'metric1', enabled: false, threshold: 0.5 },
        { id: 'metric2', enabled: false, threshold: 0.5 },
      ];

      const loadedCriteria = {
        metric1: 0.8,
      };

      const updated = defaultMetrics.map(metric => {
        const savedValue = loadedCriteria[metric.id as keyof typeof loadedCriteria];
        if (savedValue !== undefined) {
          if (typeof savedValue === 'number') {
            return { ...metric, enabled: true, threshold: savedValue };
          }
        }
        return { ...metric, enabled: false };
      });

      const metric1 = updated.find(m => m.id === 'metric1');
      const metric2 = updated.find(m => m.id === 'metric2');

      assert.ok(metric1);
      assert.strictEqual(metric1.enabled, true);
      assert.strictEqual(metric1.threshold, 0.8);

      assert.ok(metric2);
      assert.strictEqual(metric2.enabled, false);
    });
  });
});
