# Track Plan: Universal Chat Interface (The Orchestrator)

## Phase 1: Orchestrator Agent & Backend Discovery
- [ ] Task: Define the `orchestrator_agent` system configuration.
    - [ ] Subtask: Create `adk-service/system_agents/orchestrator_agent/root_agent.yaml`.
    - [ ] Subtask: Define specialized instructions for the Orchestrator to act as a router and dispatcher.
- [ ] Task: Implement Dynamic Agent Discovery.
    - [ ] Subtask: Write a utility function `getProjectRootAgents(projectName)` to scan for YAML files with `isRoot: true`.
    - [ ] Subtask: Update the assistant API to dynamically inject these agents into the Orchestrator's `sub_agents` list at session start.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Orchestrator Agent & Backend Discovery' (Protocol in workflow.md)

## Phase 2: Core Chat UI (/chat)
- [ ] Task: Scaffold the `/chat` page.
    - [ ] Subtask: Create `app/chat/page.tsx` with high-fidelity Tailwind layout.
    - [ ] Subtask: Implement the Sidebar for session history.
    - [ ] Subtask: Implement the centered Universal Input component.
- [ ] Task: Integrate Chat Logic.
    - [ ] Subtask: Use the `useAssistant` hook to drive the Orchestrator session.
    - [ ] Subtask: Implement visual indicators for agent transfers (e.g., matching the `author` field in ADK events).
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Core Chat UI' (Protocol in workflow.md)

## Phase 3: Session Management & History
- [ ] Task: Implement Unified Session Persistence.
    - [ ] Subtask: Update `lib/adk/client.ts` to support fetching sessions for the Orchestrator.
    - [ ] Subtask: Wire the sidebar to list and load these sessions.
- [ ] Task: Implement "New Chat" functionality.
    - [ ] Subtask: Create a clean state reset when the user clicks "New Chat".
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Session Management & History' (Protocol in workflow.md)

## Phase 4: User Preferences & Polish
- [ ] Task: Implement Landing Page Preference.
    - [ ] Subtask: Add a toggle in `/settings` (and potentially a small prompt on `/chat`) to set the default home route.
    - [ ] Subtask: Update `middleware.ts` or root `page.tsx` to respect this preference.
- [ ] Task: UI/UX Final Polish.
    - [ ] Subtask: Apply "Sovereign Forge" styling (glows, typography) to the new chat route.
    - [ ] Subtask: Ensure responsive mobile layout for the chat interface.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: User Preferences & Polish' (Protocol in workflow.md)
