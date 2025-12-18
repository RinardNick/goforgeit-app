'use client';

import { useState, useCallback, useMemo } from 'react';

// Types for evaluation runs
export interface EvaluationRun {
  run_id: string;
  timestamp: string;
  overall_pass_rate?: number;
  tags?: string[];
  results?: EvalResult[];
  metrics_summary?: Record<string, { avg_score: number; pass_rate: number }>;
}

export interface EvalTurnResult {
  invocation_id: string;
  actual_response?: {
    parts: Array<{ text: string }>;
  };
  actual_tool_calls?: unknown[];
  metrics?: unknown[];
  passed?: boolean;
}

export interface EvalResult {
  eval_id: string;
  passed: boolean;
  turns: EvalTurnResult[];
}

export interface EvalSetWithRuns {
  eval_set_id: string;
  runs?: EvaluationRun[];
  baseline_run_id?: string;
  eval_cases: unknown[];
}

export interface UseEvaluationRunOptions {
  agentName: string;
  evalsetId: string;
  apiBasePath: '/api/agents' | '/api/adk-agents';
  onEvalsetUpdate: (evalset: unknown) => void;
}

export interface UseEvaluationRunReturn {
  // Execution state
  isRunning: boolean;
  runProgress: number;
  currentEvalCase: number;
  runError: string | null;
  evaluationComplete: boolean;

  // Results state
  expandedResultIndex: number | null;
  showFailedOnly: boolean;
  setExpandedResultIndex: (index: number | null) => void;
  setShowFailedOnly: (show: boolean) => void;

  // Run history state
  selectedRunIndex: number | null;
  editingRunTag: string | null;
  runTagInput: string;
  setSelectedRunIndex: (index: number | null) => void;
  setRunTagInput: (input: string) => void;

  // Run comparison state
  selectedRunsForComparison: number[];
  showComparisonView: boolean;

  // Export state
  exporting: boolean;

  // Actions
  runEvaluation: (evalset: EvalSetWithRuns) => Promise<void>;
  exportEvaluation: (evalset: EvalSetWithRuns) => Promise<void>;
  addRunTag: (runId: string) => void;
  saveRunTag: (evalset: EvalSetWithRuns) => Promise<void>;
  cancelRunTag: () => void;
  setBaseline: (runId: string, evalset: EvalSetWithRuns) => Promise<void>;
  toggleRunSelection: (index: number) => void;
  openComparisonView: () => void;
  closeComparisonView: () => void;
  getCurrentRun: (evalset: EvalSetWithRuns | null) => EvaluationRun | null;
  filterResults: (results: EvalResult[]) => EvalResult[];
}

/**
 * Hook for managing evaluation run execution and history.
 * Extracts run-related state and logic from evaluation pages.
 */
export function useEvaluationRun({
  agentName,
  evalsetId,
  apiBasePath,
  onEvalsetUpdate,
}: UseEvaluationRunOptions): UseEvaluationRunReturn {
  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(0);
  const [currentEvalCase, setCurrentEvalCase] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);
  const [evaluationComplete, setEvaluationComplete] = useState(false);

  // Results state
  const [expandedResultIndex, setExpandedResultIndex] = useState<number | null>(null);
  const [showFailedOnly, setShowFailedOnly] = useState(false);

  // Run history state
  const [selectedRunIndex, setSelectedRunIndex] = useState<number | null>(null);
  const [editingRunTag, setEditingRunTag] = useState<string | null>(null);
  const [runTagInput, setRunTagInput] = useState('');

  // Run comparison state
  const [selectedRunsForComparison, setSelectedRunsForComparison] = useState<number[]>([]);
  const [showComparisonView, setShowComparisonView] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Run evaluation
  const runEvaluation = useCallback(
    async (evalset: EvalSetWithRuns) => {
      setIsRunning(true);
      setRunProgress(0);
      setCurrentEvalCase(0);
      setRunError(null);
      setEvaluationComplete(false);

      try {
        const totalCases = evalset.eval_cases.length;

        // Simulate progress tracking
        const progressInterval = setInterval(() => {
          setRunProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + (100 / totalCases) * 0.5;
          });
        }, 1000);

        const response = await fetch(`${apiBasePath}/${agentName}/evaluations/${evalsetId}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        clearInterval(progressInterval);

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to run evaluation');
        }

        onEvalsetUpdate(data.evalset);
        setRunProgress(100);
        setEvaluationComplete(true);

        setTimeout(() => {
          setEvaluationComplete(false);
        }, 5000);
      } catch (err) {
        setRunError(err instanceof Error ? err.message : 'Failed to run evaluation');
      } finally {
        setIsRunning(false);
      }
    },
    [apiBasePath, agentName, evalsetId, onEvalsetUpdate]
  );

  // Export evaluation
  const exportEvaluation = useCallback(
    async (evalset: EvalSetWithRuns) => {
      setExporting(true);
      try {
        const response = await fetch(`${apiBasePath}/${agentName}/evaluations/${evalsetId}/export`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to export evaluation');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${evalset.eval_set_id}.test.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to export evaluation');
      } finally {
        setExporting(false);
      }
    },
    [apiBasePath, agentName, evalsetId]
  );

  // Run tag management
  const addRunTag = useCallback((runId: string) => {
    setEditingRunTag(runId);
    setRunTagInput('');
  }, []);

  const saveRunTag = useCallback(
    async (evalset: EvalSetWithRuns) => {
      if (!editingRunTag || !runTagInput.trim()) return;

      try {
        const updatedRuns = evalset.runs?.map((run) => {
          if (run.run_id === editingRunTag) {
            const tags = run.tags || [];
            return { ...run, tags: [...tags, runTagInput.trim()] };
          }
          return run;
        });

        const response = await fetch(`${apiBasePath}/${agentName}/evaluations/${evalsetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runs: updatedRuns }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to save tag');
        }

        onEvalsetUpdate(data.evalset);
        setEditingRunTag(null);
        setRunTagInput('');
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to save tag');
      }
    },
    [apiBasePath, agentName, evalsetId, editingRunTag, runTagInput, onEvalsetUpdate]
  );

  const cancelRunTag = useCallback(() => {
    setEditingRunTag(null);
    setRunTagInput('');
  }, []);

  // Baseline management
  const setBaseline = useCallback(
    async (runId: string, evalset: EvalSetWithRuns) => {
      if (!confirm('Set this run as the baseline?')) return;

      try {
        const response = await fetch(`${apiBasePath}/${agentName}/evaluations/${evalsetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseline_run_id: runId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to set baseline');
        }

        onEvalsetUpdate(data.evalset);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to set baseline');
      }
    },
    [apiBasePath, agentName, evalsetId, onEvalsetUpdate]
  );

  // Run comparison
  const toggleRunSelection = useCallback((index: number) => {
    setSelectedRunsForComparison((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      return [...prev, index];
    });
  }, []);

  const openComparisonView = useCallback(() => {
    setShowComparisonView(true);
  }, []);

  const closeComparisonView = useCallback(() => {
    setShowComparisonView(false);
  }, []);

  // Get current run
  const getCurrentRun = useCallback(
    (evalset: EvalSetWithRuns | null): EvaluationRun | null => {
      if (!evalset?.runs || evalset.runs.length === 0) return null;
      if (selectedRunIndex !== null && evalset.runs[selectedRunIndex]) {
        return evalset.runs[selectedRunIndex];
      }
      return evalset.runs[evalset.runs.length - 1];
    },
    [selectedRunIndex]
  );

  // Filter results
  const filterResults = useCallback(
    (results: EvalResult[]): EvalResult[] => {
      if (!showFailedOnly) return results;
      return results.filter((r) => !r.passed);
    },
    [showFailedOnly]
  );

  return {
    // Execution state
    isRunning,
    runProgress,
    currentEvalCase,
    runError,
    evaluationComplete,

    // Results state
    expandedResultIndex,
    showFailedOnly,
    setExpandedResultIndex,
    setShowFailedOnly,

    // Run history state
    selectedRunIndex,
    editingRunTag,
    runTagInput,
    setSelectedRunIndex,
    setRunTagInput,

    // Run comparison state
    selectedRunsForComparison,
    showComparisonView,

    // Export state
    exporting,

    // Actions
    runEvaluation,
    exportEvaluation,
    addRunTag,
    saveRunTag,
    cancelRunTag,
    setBaseline,
    toggleRunSelection,
    openComparisonView,
    closeComparisonView,
    getCurrentRun,
    filterResults,
  };
}
