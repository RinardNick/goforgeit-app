# Track Spec: Universal Chat Interface (The Orchestrator)

## 1. Overview
Implement a high-fidelity, Gemini-style primary chat interface at `/chat`. This interface serves as the "Command Center" for Prometheus Forge, allowing users to interact with a primary **Orchestrator Agent** that can dynamically delegate tasks to specialized, user-created agents.

## 2. Functional Requirements
### 2.1 The Orchestrator Agent
*   **Definition:** A new system-level ADK agent named `orchestrator_agent`.
*   **Auto-Delegation:** The Orchestrator will be configured with all agents marked as `isRoot: true` in the user's project as sub-agents.
*   **Protocol:** Uses standard ADK `transfer_to_agent` logic to hand off the conversation when specialized skills are required.
*   **Discovery:** The platform will provide a mechanism to dynamically inject these top-level agent references into the Orchestrator's runtime configuration.
*   **Dynamic Sync:** The `orchestrator_agent` configuration is automatically updated or dynamically computed at runtime to ensure any newly created `isRoot: true` agents are immediately available for delegation.

### 2.2 Primary Chat UI (/chat)
*   **Visual Style:** Modern, minimalist "Gemini-inspired" layout.
*   **Core Components:**
    *   **Sidebar:** Displays unified session history with "New Chat" functionality.
    *   **Main Message Area:** Large, clean area for conversation flow.
    *   **Universal Input:** Centered, wide text input supporting multi-line queries.
*   **Active Agent Indicator:** A visual chip or badge indicating which agent (e.g., "Orchestrator" vs "Research Agent") is currently active in the session.
*   **Landing Page Toggle:** A setting allowing users to choose between the Agent Library (current home) and the Universal Chat as their default landing page.

### 2.3 Session Management
*   **Unified History:** Users can see and resume all previous conversations from the sidebar.
*   **Dynamic Context:** Each session maintains the history of transfers between agents.

## 3. Technical Requirements
*   **Frontend:** React 19 components using Tailwind CSS and the global design system (Sovereign Forge).
*   **API Layer:** Utilize the existing `/api/agents/[name]/assistant` and SSE streaming infrastructure.
*   **Runtime Config:** A new backend service/hook to scan the `agents/` directory and compile the Orchestrator's sub-agent list on-the-fly.

## 4. Acceptance Criteria
*   [ ] User can navigate to `/chat` and see a clean chat interface.
*   [ ] Starting a chat at `/chat` initiates a session with the `orchestrator_agent`.
*   [ ] If a user asks a question relevant to a specialized agent, the Orchestrator successfully transfers the turn.
*   [ ] The UI displays a clear indicator when an agent transfer occurs.
*   [ ] Users can see a list of previous chat sessions in the sidebar and click to resume them.
*   [ ] Users can toggle a preference to make `/chat` the default home page.

## 5. Out of Scope
*   Multi-modal input (files/images) in Phase 1.
*   Real-time multi-agent "group chat" (one agent at a time only).
