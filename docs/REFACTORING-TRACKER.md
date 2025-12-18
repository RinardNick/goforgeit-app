# Refactoring Tracker

This document tracks the refactoring work to reduce code duplication and improve maintainability in app.goforgeit.com.

---

## 📊 Largest Files - Current Status

| File | Original | Current | Status | Issues |
|------|----------|---------|--------|--------|
| evaluations/[evalId]/page.tsx | 2041 | **1203** | ✅ Done | 5 modals + useMetricsConfig hook |
| adk-agents/.../[evalId]/page.tsx | 2041 | **1203** | ✅ Done | Using shared modals + useMetricsConfig |
| chat/page.tsx | 1380 | **1349** | ✅ Partial | Components shared, ~2300 lines saved in dedup |
| adk-agents/.../chat/page.tsx | 1345 | **1384** | ✅ Partial | Using shared components from /components/chat |
| lib/adk/nodes.ts | 1103 | **1004** | ✅ Split | Types moved to node-types.ts (167 lines) |
| AgentComposer.tsx | 908 | 908 | ❌ Not started | Monolithic visual builder |
| AgentToolsPanel.tsx | 615 | 615 | ❌ Not started | Too many concerns |
| MCPToolsPanel.tsx | 583 | **511** | ✅ Partial | StatusBadge/KeyValueEditor extracted |

---

## 🎯 Refactoring Priorities - Progress

### 1. Eliminate Route Duplication (CRITICAL - ~4000+ lines saved)
**Status: ✅ Partially complete (~730 lines saved)**

Analysis completed. Routes differ in multi-tenancy features:
- `/api/agents/` includes org tracking for billing
- `/api/adk-agents/` is simplified version

**Approach:** Created API path context and shared compose components.

| Item | Status |
|------|--------|
| Analyze route differences | ✅ Complete |
| Create ApiPathContext | ✅ Complete |
| Consolidate compose components | ✅ Complete (3 components) |
| Update compose pages to use shared components | ✅ Complete |

### 2. Split Evaluation Pages (HIGH - 2000+ lines)
**Status: ✅ Partially complete (~1100 lines saved)**

| Item | Status |
|------|--------|
| ConversationBuilderModal.tsx | ✅ Extracted |
| ToolTrajectoryModal.tsx | ✅ Extracted |
| IntermediateResponseModal.tsx | ✅ Extracted |
| RunComparisonModal.tsx | ✅ Extracted |
| MetricsConfigModal.tsx | ✅ Extracted |
| useEvaluationRun hook | ❌ Not started |
| useMetricsConfig hook | ✅ Integrated (18 tests, ~575 lines saved) |

### 3. Decompose Chat Pages (HIGH - 1000+ lines)
**Status: ✅ Partially complete (~2300 lines saved)**

| Item | Status |
|------|--------|
| useChatSession hook | ✅ Created (11 tests passing) |
| Shared chat components folder | ✅ Created (/components/chat/) |
| Move components to shared location | ✅ Complete (10 components + types + utils) |
| Update imports in both pages | ✅ Complete |
| Delete duplicate local components | ✅ Complete |
| Integrate useChatSession hook | ⚠️ Blocked - see note |

**Note:** The useChatSession hook is too simple for the actual chat pages. Pages require:
- Streaming mode support
- ADK events tracking & parsing
- Invocations grouping
- Session state viewer
- Artifacts with upload/download
- Complex message structure with eventIds

The hook would need significant expansion to replace the page-level logic.

### 4. Unify Tool Panels (MEDIUM)
**Status: ✅ Partially complete (~76 lines saved)**

5 tool panels exist with 2499 total lines:
- AgentToolsPanel.tsx (613 lines)
- BuiltInToolsPanel.tsx (509 lines)
- CustomPythonToolsPanel.tsx (534 lines)
- MCPToolsPanel.tsx (587 → 511 lines)
- OpenAPIToolsPanel.tsx (256 lines)

**Finding:** Panels have different data structures and purposes. Unification limited to:
- [x] Create shared StatusBadge component
- [x] Create shared KeyValueEditor component
- [ ] Extract common styling patterns

---

## 📈 Lines Saved Summary

| Change | Lines Saved | Date |
|--------|-------------|------|
| Evaluation page modals ([name]) | ~550 | 2025-12-18 |
| Evaluation page modals (adk-agents) | ~550 | 2025-12-18 |
| Chat components consolidation | ~2300 | 2025-12-18 |
| Compose components consolidation | ~730 | 2025-12-18 |
| MCPToolsPanel shared components | ~76 | 2025-12-18 |
| useMetricsConfig hook integration | ~575 | 2025-12-18 |
| **Total** | **~4781 lines** | |

---

## 📝 Completed Work Log

### 2025-12-18: Evaluation Modal Extraction

**Commits:**
- `030d7cf` - Shared useChatSession hook
- `195625f` - Extract first 3 modals (ConversationBuilder, ToolTrajectory, IntermediateResponse)
- `827a536` - Extract remaining modals (RunComparison, MetricsConfig)
- `f86fbb3` - Apply modal components to adk-agents evaluation page

**Files Created:**
- `lib/hooks/useChatSession.ts` - Shared chat session management hook
- `lib/hooks/__tests__/useChatSession.test.ts` - 11 unit tests
- `app/[name]/evaluations/[evalId]/components/ConversationBuilderModal.tsx`
- `app/[name]/evaluations/[evalId]/components/ToolTrajectoryModal.tsx`
- `app/[name]/evaluations/[evalId]/components/IntermediateResponseModal.tsx`
- `app/[name]/evaluations/[evalId]/components/RunComparisonModal.tsx`
- `app/[name]/evaluations/[evalId]/components/MetricsConfigModal.tsx`
- `app/[name]/evaluations/[evalId]/components/index.ts`

**Types Added to `lib/adk/evaluation-types.ts`:**
- `MetricConfig` - UI metric configuration interface
- `MetricsConfigJson` - JSON format for metrics persistence

### 2025-12-18: Chat Components Consolidation

**Changes:**
- Created `/components/chat/` shared folder
- Moved 10 chat components + types.ts + utils.tsx to shared location
- Updated imports in both `[name]/chat/page.tsx` and `adk-agents/[name]/chat/page.tsx`
- Deleted duplicate local component folders
- Created barrel file `index.ts` for clean imports

**Files Created:**
- `components/chat/index.ts` - Barrel exports for all components
- `components/chat/types.ts` - Shared type definitions
- `components/chat/utils.tsx` - Shared utility functions
- `components/chat/ChatHeader.tsx`
- `components/chat/ChatInput.tsx`
- `components/chat/SessionsPanel.tsx`
- `components/chat/DeleteSessionDialog.tsx`
- `components/chat/EventsPanel.tsx`
- `components/chat/StatePanel.tsx`
- `components/chat/TracePanel.tsx`
- `components/chat/ArtifactsPanel.tsx`
- `components/chat/ArtifactPreviewModal.tsx`
- `components/chat/ArtifactUploadModal.tsx`

**Files Deleted (duplicates):**
- `app/[name]/chat/components/` - Entire folder
- `app/[name]/chat/types.ts`
- `app/[name]/chat/utils.tsx`
- `app/adk-agents/[name]/chat/components/` - Entire folder
- `app/adk-agents/[name]/chat/types.ts`
- `app/adk-agents/[name]/chat/utils.tsx`

### 2025-12-18: Compose Components Consolidation

**Changes:**
- Created `/lib/contexts/ApiPathContext.tsx` for API path configuration
- Created `/components/compose/` shared folder
- Moved 3 compose components to shared location with configurable paths
- Updated both compose pages to use shared components with path props
- Deleted duplicate local component folders

**Files Created:**
- `lib/contexts/ApiPathContext.tsx` - React context for API/nav path configuration
- `lib/contexts/index.ts` - Barrel exports for contexts
- `components/compose/index.ts` - Barrel exports for compose components
- `components/compose/AIAssistantPanel.tsx` - With apiBasePath prop
- `components/compose/ComposeHeader.tsx` - With navBasePath prop
- `components/compose/YAMLEditorPanel.tsx`

**Files Deleted (duplicates):**
- `app/[name]/compose/AIAssistantPanel.tsx`
- `app/[name]/compose/components/` - Entire folder
- `app/adk-agents/[name]/compose/AIAssistantPanel.tsx`
- `app/adk-agents/[name]/compose/components/` - Entire folder

### 2025-12-18: Split nodes.ts Types

**Changes:**
- Created `lib/adk/node-types.ts` with 167 lines of type definitions
- Reduced `lib/adk/nodes.ts` from 1103 to 1004 lines
- Added re-exports for backwards compatibility
- Organizational improvement (types vs utilities separation)

**Files Created:**
- `lib/adk/node-types.ts` - All type definitions (AgentFile, ParsedAgent, ToolEntry, etc.)

**Files Modified:**
- `lib/adk/nodes.ts` - Now imports types, removed inline definitions

### 2025-12-18: MCPToolsPanel Shared Components

**Changes:**
- Created shared `/app/components/AgentComposer/shared/` folder
- Extracted StatusBadge component for connection status display
- Extracted KeyValueEditor component for env vars, headers
- Updated MCPToolsPanel to use shared components
- MCPToolsPanel reduced from 587 to 511 lines

**Files Created:**
- `app/components/AgentComposer/shared/StatusBadge.tsx` - Connection status badge
- `app/components/AgentComposer/shared/KeyValueEditor.tsx` - Key-value pair editor
- `app/components/AgentComposer/shared/index.ts` - Barrel exports

**Files Modified:**
- `app/components/AgentComposer/MCPToolsPanel.tsx` - Now imports from shared

---

### 2025-12-18: useMetricsConfig Hook Extraction & Integration

**Commits:**
- `d48d8ae` - Initial hook extraction
- `de66261` - Integrate hook into both evaluation pages

**Changes:**
- Created `lib/hooks/useMetricsConfig.ts` hook for evaluation metrics management
- Extracts ~575 lines of metrics-related state and handlers from evaluation pages
- Supports both `/api/agents` and `/api/adk-agents` routes via apiBasePath parameter
- Added jsonPreview (useMemo) and auto-load config on modal open
- Integrated hook into both evaluation pages

**Files Created/Modified:**
- `lib/hooks/useMetricsConfig.ts` - Metrics configuration hook
- `lib/hooks/__tests__/useMetricsConfig.test.ts` - 18 unit tests
- `app/[name]/evaluations/[evalId]/page.tsx` - 1490→1203 lines
- `app/adk-agents/[name]/evaluations/[evalId]/page.tsx` - 1491→1203 lines

**Hook API:**
- State: metrics, showMetricsConfig, hasCustomConfig, isSaving, saveMessage, jsonPreview
- Modal: openMetricsConfig, closeMetricsConfig
- Actions: toggleMetric, setThreshold, setRubric, applyTemplate
- API: loadConfig, saveConfig, resetConfig

---

## 🔄 In Progress

*No active work - ready for next task*

---

## 📋 Next Steps

1. **Extract useEvaluationRun hook** - Handle evaluation execution logic (~30 useState calls remain)
2. **Expand useChatSession hook** - Add streaming, ADK events, invocations support
3. **Extract ConfirmDialog patterns** - Common delete confirmation across tool panels
4. **AgentComposer decomposition** - Split 908-line monolithic visual builder
