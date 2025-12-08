# Phase 18.9: Evaluation Metrics Configuration UI - User Stories

## Overview

Users need to configure which evaluation metrics to use, set thresholds, and write custom LLM evaluation prompts. This allows them to customize how ADK scores their agent's performance during evaluations.

---

## Story 18.9.1: View "Configure Metrics" Button

**As a** developer testing my agent
**I want to** see a "Configure Metrics" button on the evalset detail page
**So that** I know I can customize evaluation metrics

**Acceptance Criteria:**
- [ ] "Configure Metrics" button appears next to "Run Evaluation" button
- [ ] Button is visible when evalset page loads
- [ ] Button shows "Configure Metrics" text
- [ ] Button has `data-testid="configure-metrics-btn"`

**Test file:** `phase18.9-metrics-config.spec.ts`

---

## Story 18.9.2: Open Metrics Configuration Modal

**As a** developer
**I want to** click "Configure Metrics" to open a configuration modal
**So that** I can see and edit metric settings

**Acceptance Criteria:**
- [ ] Clicking "Configure Metrics" opens a modal/dialog
- [ ] Modal has title "Configure Evaluation Metrics"
- [ ] Modal has `data-testid="metrics-config-modal"`
- [ ] Modal shows loading state while fetching current config
- [ ] Modal displays after loading completes

**Test file:** `phase18.9-metrics-config.spec.ts`

---

## Story 18.9.3: View Default Metric Configuration

**As a** developer
**I want to** see the default ADK metrics and their thresholds
**So that** I understand what will be evaluated

**Acceptance Criteria:**
- [ ] Modal shows all 7 ADK metrics in a list
- [ ] Each metric card shows:
  - Metric name (user-friendly)
  - Metric ID (technical name)
  - Description of what it measures
  - Current threshold value (0.0 - 1.0)
  - Enable/disable toggle
- [ ] Default metrics shown when no .config.json exists:
  - `tool_trajectory_avg_score`: enabled, threshold 1.0
  - `response_match_score`: enabled, threshold 0.8
  - All LLM metrics: disabled by default
- [ ] Badge shows "Using Defaults" when no custom config

**Test file:** `phase18.9-metrics-config.spec.ts`

---

## Story 18.9.4: Toggle Metric On/Off

**As a** developer
**I want to** enable or disable specific metrics
**So that** I can focus on the metrics that matter for my agent

**Acceptance Criteria:**
- [ ] Each metric card has a toggle switch
- [ ] Toggle has `data-testid="metric-toggle-{metric_id}"`
- [ ] Clicking toggle changes state (on → off, off → on)
- [ ] Disabled metrics appear grayed out
- [ ] Disabled metrics show "Disabled" badge
- [ ] Changes are reflected in JSON preview
- [ ] At least 1 metric must remain enabled (can't disable all)

**Test file:** `phase18.9-metrics-config.spec.ts`

---

## Story 18.9.5: Adjust Metric Threshold

**As a** developer
**I want to** adjust the threshold for each metric
**So that** I can set how strict or lenient the evaluation should be

**Acceptance Criteria:**
- [ ] Each enabled metric shows a threshold slider
- [ ] Slider ranges from 0.0 to 1.0
- [ ] Slider shows current value as label (e.g., "0.75")
- [ ] Slider has `data-testid="threshold-slider-{metric_id}"`
- [ ] Dragging slider updates threshold value
- [ ] Value updates in real-time as slider moves
- [ ] Changes are reflected in JSON preview
- [ ] Disabled metrics don't show slider (grayed out)

**Test file:** `phase18.9-metrics-config.spec.ts`

---

## Story 18.9.6: Edit Custom Rubric for LLM Metrics

**As a** developer
**I want to** write custom evaluation prompts for LLM-based metrics
**So that** the LLM judge scores responses according to my criteria

**Acceptance Criteria:**
- [ ] LLM metrics with rubric support show "Edit Rubric" button:
  - `rubric_based_final_response_quality_v1`
  - `rubric_based_tool_use_quality_v1`
- [ ] Clicking "Edit Rubric" opens text editor
- [ ] Editor has `data-testid="rubric-editor-{metric_id}"`
- [ ] Editor is a textarea (Monaco editor = future enhancement)
- [ ] Editor shows placeholder: "Write custom evaluation criteria..."
- [ ] Editor supports multiline text (newlines)
- [ ] Changes are reflected in JSON preview
- [ ] LLM metrics without rubric don't show editor

**Test file:** `phase18.9-metrics-config.spec.ts`

---

## Story 18.9.7: Save Custom Metric Configuration

**As a** developer
**I want to** save my custom metric configuration
**So that** it's used when I run evaluations

**Acceptance Criteria:**
- [ ] Modal has "Save Configuration" button
- [ ] Button has `data-testid="save-config-btn"`
- [ ] Clicking button sends POST request to `/api/adk-agents/{name}/evaluations/{id}/config`
- [ ] Request body contains `criteria` object with enabled metrics
- [ ] Success shows "Configuration saved" notification
- [ ] Modal shows loading state during save
- [ ] After save, modal shows "Using Custom Config" badge
- [ ] Backend creates `{evalset_id}.config.json` in evaluations directory
- [ ] File contains valid ADK config JSON

**Test file:** `phase18.9-metrics-config.spec.ts`

**Backend API Test:** `app/api/adk-agents/[name]/evaluations/[id]/config/route.test.ts`

---

## Story 18.9.8: Load Saved Metric Configuration

**As a** developer
**I want to** see my previously saved configuration when I reopen the modal
**So that** I can edit or review my settings

**Acceptance Criteria:**
- [ ] Opening modal fetches config via GET `/api/adk-agents/{name}/evaluations/{id}/config`
- [ ] If .config.json exists, show "Using Custom Config" badge
- [ ] Enabled metrics show as toggled on
- [ ] Disabled metrics show as toggled off
- [ ] Threshold sliders show saved values
- [ ] Rubric editors show saved prompts
- [ ] JSON preview shows loaded config
- [ ] If no .config.json, show defaults + "Using Defaults" badge

**Test file:** `phase18.9-metrics-config.spec.ts`

---

## Story 18.9.9: Reset to Default Configuration

**As a** developer
**I want to** reset my custom configuration back to ADK defaults
**So that** I can start fresh if my changes aren't working

**Acceptance Criteria:**
- [ ] Modal has "Reset to Defaults" button
- [ ] Button has `data-testid="reset-config-btn"`
- [ ] Clicking button shows confirmation dialog
- [ ] Confirmation says "This will delete your custom configuration. Continue?"
- [ ] Confirming sends DELETE request to `/api/adk-agents/{name}/evaluations/{id}/config`
- [ ] Success shows "Reset to defaults" notification
- [ ] Backend deletes `{evalset_id}.config.json` file
- [ ] Modal updates to show default values
- [ ] Badge changes from "Using Custom Config" to "Using Defaults"

**Test file:** `phase18.9-metrics-config.spec.ts`

---

## Story 18.9.10: View JSON Preview of Configuration

**As a** developer
**I want to** see the raw JSON that will be saved
**So that** I understand exactly what configuration will be used

**Acceptance Criteria:**
- [ ] Modal has "JSON Preview" collapsible section
- [ ] Section has `data-testid="json-preview"`
- [ ] Clicking section header expands/collapses preview
- [ ] Preview shows formatted JSON with:
  - `criteria` object
  - Enabled metrics with thresholds
  - LLM metrics with rubric text
- [ ] Preview updates in real-time as settings change
- [ ] JSON is syntax-highlighted (basic)
- [ ] JSON is read-only (can't edit directly - future enhancement)

**Test file:** `phase18.9-metrics-config.spec.ts`

---

## Story 18.9.11: Run Evaluation with Custom Config

**As a** developer
**I want to** run an evaluation that uses my custom metric configuration
**So that** my agent is scored according to my criteria

**Acceptance Criteria:**
- [ ] When .config.json exists, "Run Evaluation" shows "Using custom config" indicator
- [ ] Backend checks for `{evalset_id}.config.json` before running eval
- [ ] If config exists, pass `--config_file_path {evalset_id}.config.json` to `adk eval` command
- [ ] If config doesn't exist, run `adk eval` without config flag (uses defaults)
- [ ] Eval runs successfully with custom config
- [ ] Results reflect custom thresholds (e.g., lower threshold = more passing tests)
- [ ] Eval results show which config was used

**Test file:** `phase18.9-metrics-config.spec.ts`

**Backend API Test:** `app/api/adk-agents/[name]/evaluations/[id]/run/route.test.ts`

---

## Story 18.9.12: Apply Config Template (Strict/Balanced/Lenient)

**As a** developer
**I want to** quickly apply a pre-configured template
**So that** I don't have to manually adjust each threshold

**Acceptance Criteria:**
- [ ] Modal has "Apply Template" dropdown
- [ ] Dropdown has `data-testid="config-template-select"`
- [ ] Three templates available:
  - **Strict**: All thresholds 0.9+
  - **Balanced**: Thresholds 0.7-0.8
  - **Lenient**: Thresholds 0.5-0.6
- [ ] Selecting template updates all metric thresholds
- [ ] Changes are reflected immediately in UI
- [ ] JSON preview updates to show template values
- [ ] Templates don't change rubric prompts (only thresholds)
- [ ] User can still manually adjust after applying template

**Test file:** `phase18.9-metrics-config.spec.ts`

---

## Technical Implementation Notes

### File Structure
```
adk-service/agents/
├── marketing_team/
│   └── evaluations/
│       ├── simple.test.json          # Test cases
│       └── simple.config.json        # Metrics config ← NEW
```

### Config File Format (ADK Standard)
```json
{
  "criteria": {
    "tool_trajectory_avg_score": 1.0,
    "response_match_score": 0.8,
    "rubric_based_final_response_quality_v1": {
      "threshold": 0.7,
      "rubric": "Assess response quality:\n1. Helpfulness (40pts)\n2. Accuracy (40pts)\n3. Completeness (20pts)\n\nProvide score 0-100."
    },
    "hallucinations_v1": {
      "threshold": 0.9,
      "evaluate_intermediate_nl_responses": true
    }
  }
}
```

### API Endpoints
```typescript
// GET /api/adk-agents/[name]/evaluations/[id]/config
Response: {
  config: ConfigJSON | null,
  hasCustomConfig: boolean,
  configPath: string
}

// POST /api/adk-agents/[name]/evaluations/[id]/config
Request: {
  criteria: {
    [metric_id: string]: number | { threshold: number, rubric?: string, ... }
  }
}
Response: {
  success: boolean,
  configPath: string
}

// DELETE /api/adk-agents/[name]/evaluations/[id]/config
Response: {
  success: boolean,
  message: "Configuration reset to defaults"
}
```

### 7 ADK Metrics Reference

| Metric ID | Type | Configurable | Default Threshold |
|-----------|------|--------------|-------------------|
| `tool_trajectory_avg_score` | Deterministic | Threshold only | 1.0 |
| `response_match_score` | Deterministic | Threshold only | 0.8 |
| `final_response_match_v2` | LLM | Threshold only | - |
| `rubric_based_final_response_quality_v1` | LLM | Threshold + Rubric | - |
| `rubric_based_tool_use_quality_v1` | LLM | Threshold + Rubric | - |
| `hallucinations_v1` | LLM | Threshold + Options | - |
| `safety_v1` | LLM | Threshold only | - |

---

## Test Plan Summary

**Total Stories:** 12
**Test File:** `e2e/adk-visual-builder/phase18.9-metrics-config.spec.ts`

**Test Coverage:**
- ✅ Story 18.9.1: Configure button visibility
- ✅ Story 18.9.2: Open modal
- ✅ Story 18.9.3: View defaults
- ✅ Story 18.9.4: Toggle metrics
- ✅ Story 18.9.5: Adjust thresholds
- ✅ Story 18.9.6: Edit rubrics
- ✅ Story 18.9.7: Save config
- ✅ Story 18.9.8: Load config
- ✅ Story 18.9.9: Reset config
- ✅ Story 18.9.10: JSON preview
- ✅ Story 18.9.11: Run with config
- ✅ Story 18.9.12: Apply templates

**Estimated LOC:**
- E2E Tests: ~600 lines
- Backend API: ~150 lines (config route)
- Backend API Update: ~20 lines (run route)
- Frontend Modal: ~400 lines (new component)
- Total: ~1,170 lines

---

## Implementation Order (TDD Red-Green-Refactor)

1. **Story 18.9.1** - Configure button (simplest, UI only)
2. **Story 18.9.2** - Open modal (UI scaffolding)
3. **Story 18.9.3** - View defaults (GET API + UI)
4. **Story 18.9.7** - Save config (POST API)
5. **Story 18.9.8** - Load config (GET API integration)
6. **Story 18.9.4** - Toggle metrics (UI state)
7. **Story 18.9.5** - Adjust thresholds (UI state)
8. **Story 18.9.6** - Edit rubrics (UI state)
9. **Story 18.9.10** - JSON preview (derived state)
10. **Story 18.9.12** - Apply templates (presets)
11. **Story 18.9.9** - Reset config (DELETE API)
12. **Story 18.9.11** - Run with config (integration)

**Note:** Implement each story with full Red-Green-Refactor TDD cycle before moving to next.
