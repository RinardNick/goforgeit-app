# Track Plan: Agent API Experience

## Phase 1: Backend - API Key Management & Scoping [checkpoint: 45569c1]
- [x] Task: Create database migration for granular API key scoping. [01f556d]
    - [x] Subtask: Add `scoped_agents` (UUID array) to `api_keys` table.
    - [x] Subtask: Update `api_keys` to include `org_id` properly if missing (verifying 022).
- [x] Task: Implement Backend API for API Key Scoping. [347d58d]
    - [x] Subtask: Update `lib/auth/api-keys.ts` or create `lib/db/api-keys.ts` to support CRUD with scoping.
    - [x] Subtask: Implement `POST /api/api-keys` with agent/org scoping logic.
    - [x] Subtask: Implement `GET /api/api-keys` to list keys and their scopes.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Backend - API Key Management & Scoping' (Protocol in workflow.md)

## Phase 2: Backend - Agent Execution API & Streaming [checkpoint: 0b4da22]
- [x] Task: Implement the Execution API with API Key authentication. [0b4da22]
    - [x] Subtask: Update `app/api/agents/[name]/execute/route.ts` to support `X-Forge-Api-Key`.
    - [x] Subtask: Implement `X-Forge-Api-Key` validation and scoping checks.
- [x] Task: Implement Streaming (SSE) for the Execution API. [0b4da22]
    - [x] Subtask: Support token-level streaming for API-authenticated requests.
    - [x] Subtask: Implement explicit session creation and linking to `api_key_id`.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Backend - Agent Execution API & Streaming' (Protocol in workflow.md) [0b4da22]

## Phase 3: Frontend - API Key Management UI [checkpoint: 5085759]
- [x] Task: Enhance the API Keys Settings page. [5085759]
    - [x] Subtask: Update `app/settings/api-keys/page.tsx` to allow naming and scoping keys.
    - [x] Subtask: Implement "Select Agents" UI (multi-select) for scoping.
    - [x] Subtask: Add "Organization-Wide" toggle for scoping.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Frontend - API Key Management UI' (Protocol in workflow.md) [5085759]

## Phase 4: Frontend - Developer Info UI (`</>` Icon) [checkpoint: 99568b8]
- [x] Task: Add `</>` Developer Info button to Agent UI. [99568b8]
    - [x] Subtask: Add the icon to `ComposeHeader.tsx` and `ChatHeader.tsx`.
- [x] Task: Implement the API Instructions Modal. [99568b8]
    - [x] Subtask: Create `components/AgentComposer/ApiInstructionsModal.tsx`.
    - [x] Subtask: Implement copyable `curl` and code snippets (JS, Python) for the current agent.
    - [x] Subtask: Include endpoint URL and `X-Forge-Api-Key` header documentation.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Frontend - Developer Info UI' (Protocol in workflow.md) [99568b8]

## Phase 5: Visibility & Polish
- [ ] Task: Verify External Sessions in Forge UI.
    - [ ] Subtask: Confirm sessions created via API appear in the sessions list with the correct naming.
    - [ ] Subtask: Verify traces and events for these sessions are visible.
- [ ] Task: Final UI/UX Polish.
    - [ ] Subtask: Ensure consistent styling and handle edge cases (e.g., no agents selected in scoping).
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Visibility & Polish' (Protocol in workflow.md)