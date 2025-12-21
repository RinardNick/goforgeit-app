# Track Plan: Agent API Experience

## Phase 1: Backend - API Key Management & Scoping [checkpoint: 45569c1]
- [x] Task: Create database migration for granular API key scoping. [01f556d]
    - [ ] Subtask: Add `scoped_agents` (UUID array) to `api_keys` table.
    - [ ] Subtask: Update `api_keys` to include `org_id` properly if missing (verifying 022).
- [x] Task: Implement Backend API for API Key Scoping. [347d58d]
    - [ ] Subtask: Update `lib/auth/api-keys.ts` or create `lib/db/api-keys.ts` to support CRUD with scoping.
    - [ ] Subtask: Implement `POST /api/api-keys` with agent/org scoping logic.
    - [ ] Subtask: Implement `GET /api/api-keys` to list keys and their scopes.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Backend - API Key Management & Scoping' (Protocol in workflow.md)

## Phase 2: Backend - Agent Execution API & Streaming
- [~] Task: Implement the Execution API with API Key authentication.
    - [ ] Subtask: Create `app/api/v1/agents/[name]/execute/route.ts`.
    - [ ] Subtask: Implement `X-Forge-Api-Key` validation middleware/helper that checks scoping (Org-wide vs. Specific Agents).
- [ ] Task: Implement Streaming (SSE) for the Execution API.
    - [ ] Subtask: Integrate with ADK to proxy the streaming response to the external caller.
    - [ ] Subtask: Implement session naming logic: `<key-name>-<session-id>`.
    - [ ] Subtask: Ensure `agent_sessions` record the `api_key_id` for traceability.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Backend - Agent Execution API & Streaming' (Protocol in workflow.md)

## Phase 3: Frontend - API Key Management UI
- [ ] Task: Enhance the API Keys Settings page.
    - [ ] Subtask: Update `app/settings/api-keys/page.tsx` to allow naming and scoping keys.
    - [ ] Subtask: Implement "Select Agents" UI (multi-select) for scoping.
    - [ ] Subtask: Add "Organization-Wide" toggle for scoping.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Frontend - API Key Management UI' (Protocol in workflow.md)

## Phase 4: Frontend - Developer Info UI (`</>` Icon)
- [ ] Task: Add `</>` Developer Info button to Agent UI.
    - [ ] Subtask: Add the icon to `ComposeHeader.tsx` and `ChatHeader.tsx`.
- [ ] Task: Implement the API Instructions Modal.
    - [ ] Subtask: Create `components/AgentComposer/ApiInstructionsModal.tsx`.
    - [ ] Subtask: Implement copyable `curl` and code snippets (JS, Python) for the current agent.
    - [ ] Subtask: Include endpoint URL and `X-Forge-Api-Key` header documentation.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Frontend - Developer Info UI' (Protocol in workflow.md)

## Phase 5: Visibility & Polish
- [ ] Task: Verify External Sessions in Forge UI.
    - [ ] Subtask: Confirm sessions created via API appear in the sessions list with the correct naming.
    - [ ] Subtask: Verify traces and events for these sessions are visible.
- [ ] Task: Final UI/UX Polish.
    - [ ] Subtask: Ensure consistent styling and handle edge cases (e.g., no agents selected in scoping).
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Visibility & Polish' (Protocol in workflow.md)
