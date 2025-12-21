# Track Plan: Tool Registry UI

## Phase 1: Analysis & Scaffolding
- [x] Task: Analyze existing AgentComposer structure and backend API for tools.
    - [x] Subtask: Review `app/components/AgentComposer` to identify the best integration point for the Tools panel.
    - [x] Subtask: Inspect `app/api/agents/[name]/assistant` and `adk-service` to understand how to fetch/save tools.
    - [x] Subtask: Document the API contract for tool management (CRUD operations).
- [x] Task: Create the basic UI shell for the Tool Registry. 47b3a26
    - [x] Subtask: Create `app/components/AgentComposer/ToolRegistryPanel.tsx`.
    - [x] Subtask: Add a "Tools" tab/button to `app/components/AgentComposer/Navigation.tsx` (or equivalent).
    - [x] Subtask: Implement a basic list view in `ToolsPanel` to display placeholder tool data.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Analysis & Scaffolding' (Protocol in workflow.md)

## Phase 2: Tool Listing & Management
- [ ] Task: Connect the Tool List to the backend.
    - [ ] Subtask: Implement a fetch function (e.g., in a hook `useTools`) to get the real list of tools from the API.
    - [ ] Subtask: Update `ToolsPanel` to render the fetched tools with their names and descriptions.
- [ ] Task: Implement Tool Details/Edit View.
    - [ ] Subtask: Create `ToolEditor.tsx` using `@monaco-editor/react` for viewing tool code/schema.
    - [ ] Subtask: Allow clicking a tool in the list to open it in the `ToolEditor` (read-only for system tools, editable for custom).
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Tool Listing & Management' (Protocol in workflow.md)

## Phase 3: Tool Creation Flow ("The Forge")
- [ ] Task: Implement the "New Tool" dialog/modal.
    - [ ] Subtask: Create a modal that accepts a natural language description for a new tool.
- [ ] Task: Integrate with the Builder/Forge Agent.
    - [ ] Subtask: Implement the API call to send the user's description to the Builder Agent.
    - [ ] Subtask: Handle the streaming response (if applicable) or the final generated tool definition.
    - [ ] Subtask: Populate the `ToolEditor` with the generated code/schema for review.
- [ ] Task: Implement "Save Tool" functionality.
    - [ ] Subtask: Create the API call to persist the new tool definition to the backend/ADK.
    - [ ] Subtask: Refresh the tool list upon successful save.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Tool Creation Flow' (Protocol in workflow.md)

## Phase 4: Integration & Polish
- [ ] Task: Verify end-to-end flow.
    - [ ] Subtask: Create a tool using the new UI, assign it to an agent, and verify the agent can use it (using the existing Chat panel).
- [ ] Task: UI Polish.
    - [ ] Subtask: Ensure empty states, loading states, and error states are handled gracefully.
    - [ ] Subtask: Apply "Sovereign Forge" styling (dark mode, semantic colors) to match the Product Guidelines.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Integration & Polish' (Protocol in workflow.md)
