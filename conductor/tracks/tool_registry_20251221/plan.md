# Implementation Plan: Centralized Tool Registry

## Phase 1: Database Schema & Core Logic [checkpoint: 0b12bac]
- [x] Task: Create database migration for `tool_registry`. (3f94cbc)
    - [x] Subtask: Define schema including name, type, description, config (JSONB), org_id, category, tags (JSONB).
- [x] Task: Implement `lib/db/tool-registry.ts` CRUD operations. (e813d9d)
    - [x] Subtask: Write unit tests for creating, reading, updating, and deleting tools.
    - [x] Subtask: Implement `registerTool`, `listTools`, `getTool`, `updateTool`, `deleteTool`.
- [x] Task: Refactor ADK file structure for "Shared" tools. (e813d9d)
    - [x] Subtask: Create `lib/adk/shared/tools` directory.
    - [x] Subtask: Implement utility to move/link files from agent-specific folders to shared storage.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Database Schema & Core Logic' (Protocol in workflow.md) (0b12bac)

## Phase 2: AI Categorization Engine
- [ ] Task: Implement AI Categorization Service using Genkit.
    - [ ] Subtask: Create a new Genkit flow that takes tool code/definition and returns a category and tags.
    - [ ] Subtask: Write unit tests with mocked LLM responses.
    - [ ] Subtask: Integrate categorization into the `registerTool` database logic.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: AI Categorization Engine' (Protocol in workflow.md)

## Phase 3: Tool Management UI (Standalone)
- [ ] Task: Create `/settings/tools` management page.
    - [ ] Subtask: Implement a list view of all registered tools and MCP servers.
    - [ ] Subtask: Create a "Register Tool" dialog that allows selecting an existing tool from an agent.
    - [ ] Subtask: Create an "Add MCP Server" dialog.
- [ ] Task: Implement tool editing and deletion in the UI.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Tool Management UI (Standalone)' (Protocol in workflow.md)

## Phase 4: Integration UI (Agent Builder)
- [ ] Task: Enhance existing Tools Panel in `AgentComposer`.
    - [ ] Subtask: Add a "Browse Library" tab/modal to the existing Tools panel.
    - [ ] Subtask: Implement search and filtering for global tools within this view.
    - [ ] Subtask: Add "Import" functionality that adds a library tool to the agent's active toolset.
- [ ] Task: Update Agent execution logic to resolve tools from the shared library.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Integration UI (Agent Builder)' (Protocol in workflow.md)

## Phase 5: Polish & Final Integration
- [ ] Task: Final end-to-end testing.
    - [ ] Subtask: Verify an MCP server registered once can be used by multiple agents.
    - [ ] Subtask: Verify a custom Python tool moved to shared storage still executes correctly.
- [ ] Task: UI/UX polish and responsive testing.
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Polish & Final Integration' (Protocol in workflow.md)
