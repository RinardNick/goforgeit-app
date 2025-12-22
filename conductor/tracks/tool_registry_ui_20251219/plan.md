# Track Plan: Tool Registry UI

## Phase 1: Analysis & Scaffolding [checkpoint: ab85b1c]
- [x] Task: Analyze existing AgentComposer structure and backend API for tools.
    - [x] Subtask: Review `app/components/AgentComposer` to identify the best integration point for the Tools panel.
    - [x] Subtask: Inspect `app/api/agents/[name]/assistant` and `adk-service` to understand how to fetch/save tools.
    - [x] Subtask: Document the API contract for tool management (CRUD operations).
- [x] Task: Create the basic UI shell for the Tool Registry. 47b3a26
    - [x] Subtask: Create `app/components/AgentComposer/ToolRegistryPanel.tsx`.
    - [x] Subtask: Add a "Tools" tab/button to `app/components/AgentComposer/Navigation.tsx` (or equivalent).
    - [x] Subtask: Implement a basic list view in `ToolsPanel` to display placeholder tool data.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Analysis & Scaffolding' (Protocol in workflow.md) ab85b1c

## Phase 2: Tool Listing & Management [checkpoint: a92ea70]
- [x] Task: Connect the Tool List to the backend. d107835
    - [x] Subtask: Implement a fetch function (e.g., in a hook `useTools`) to get the real list of tools from the API.
    - [x] Subtask: Update `ToolsPanel` to render the fetched tools with their names and descriptions.
- [x] Task: Implement Tool Details/Edit View. a954142
    - [x] Subtask: Create `ToolEditor.tsx` using `@monaco-editor/react` for viewing tool code/schema.
    - [x] Subtask: Allow clicking a tool in the list to open it in the `ToolEditor` (read-only for system tools, editable for custom).
- [x] Task: Conductor - User Manual Verification 'Phase 2: Tool Listing & Management' (Protocol in workflow.md) a92ea70

## Phase 3: Tool Creation Flow ("The Forge") [checkpoint: 4503465]
- [x] Task: Implement the "New Tool" dialog/modal. 42ab19a
    - [x] Subtask: Create a modal that accepts a natural language description for a new tool.
- [x] Task: Integrate with the Builder/Forge Agent. 42ab19a
    - [x] Subtask: Implement the API call to send the user's description to the Builder Agent.
    - [x] Subtask: Handle the streaming response (if applicable) or the final generated tool definition.
    - [x] Subtask: Populate the `ToolEditor` with the generated code/schema for review.
- [x] Task: Implement "Save Tool" functionality. 42ab19a
    - [x] Subtask: Create the API call to persist the new tool definition to the backend/ADK.
    - [x] Subtask: Refresh the tool list upon successful save.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Tool Creation Flow' (Protocol in workflow.md) 4503465

## Phase 4: Integration & Polish [checkpoint: f2fd1ea]
- [x] Task: Verify end-to-end flow. f2fd1ea
    - [x] Subtask: Create a tool using the new UI, assign it to an agent, and verify the agent can use it (using the existing Chat panel).
- [x] Task: UI Polish. f2fd1ea
- [x] Task: Conductor - User Manual Verification 'Phase 4: Integration & Polish' (Protocol in workflow.md) f2fd1ea

## Phase 5: Streaming Infrastructure [checkpoint: a48dedd]
- [x] Task: Extract the `useAssistant` hook. a48dedd
    - [x] Subtask: Identify core chat and SSE logic in `AIAssistantPanel.tsx`.
    - [x] Subtask: Implement `lib/hooks/useAssistant.ts` to manage messages, loading state, and SSE parsing.
    - [x] Subtask: Refactor `AIAssistantPanel.tsx` to use the new hook.
- [x] Task: Update Assistant API for Tool Streaming. a48dedd
    - [x] Subtask: Ensure `app/api/agents/[name]/assistant/route.ts` correctly pipes `functionCall` events to the SSE stream.
    - [x] Subtask: Add a "dry-run" mode or similar if needed to ensure files aren't committed to disk before user approval.
- [x] Task: Conductor - User Manual Verification 'Phase 5: Streaming Infrastructure' (Protocol in workflow.md) a48dedd

## Phase 6: Forge Workspace UI [checkpoint: a48dedd]
- [x] Task: Create the `ForgeWorkspaceModal` component. a48dedd
    - [x] Subtask: Implement large modal shell with split-view layout.
    - [x] Subtask: Integrate `useAssistant` for the left-side chat area.
    - [x] Subtask: Implement the right-side "Live Preview" using Monaco Editor.
    - [x] Subtask: Logic to detect `write_files` in the stream and update preview buffers.
- [x] Task: Wire up the "Save & Register" flow. a48dedd
    - [x] Subtask: Implement the final commit of forged files to the backend.
    - [x] Subtask: Auto-close workspace and open Tool Registry on success.
- [x] Task: Conductor - User Manual Verification 'Phase 6: Forge Workspace UI' (Protocol in workflow.md) f2fd1ea
