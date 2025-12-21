# Specification: Agent API Experience

## Overview
This track introduces a developer-centric experience to the Forge platform. It enables users to expose their agents via a streaming API, allowing external applications to leverage Forge agents. Key components include **centralized API key management in the Settings dashboard** with granular scoping, a "Developer Info" UI within the Agent Composer and Chat, and enhanced session tracking for external API calls.

## User Stories
- As a developer, I want to create named API keys **in my Settings** so I can authenticate my external applications.
- As a developer, I want to scope my API keys to specific agents or an entire organization to maintain security.
- As a user, I want to see a `</>` icon in the Agent interface to quickly access API documentation and integration snippets.
- As an orchestrator, I want sessions created by external apps to be visible in Forge, prefixed with the API key name, so I can debug and trace their execution.

## Functional Requirements

### 1. Centralized API Key Management (Settings)
- **Location:** All API key creation and management occurs in a dedicated "API Keys" section within the global **Settings** area.
- **Creation:** Users can generate new API keys, which are displayed only once.
- **Naming:** Each key must have a unique display name (e.g., "Customer-Support-Bot").
- **Scoping Settings:** 
    - Upon creation or edit, keys can be configured for:
        - **Specific Agents:** Select one or multiple agents from the organization.
        - **Organization-Wide:** Access to all agents within the user's organization.
    - Keys are strictly limited to the agents the creating user's organization has access to.
- **Security:** Keys must be stored securely (hashed/encrypted). 

### 2. Developer Information UI (`</>` Icon)
- **Placement:** A new `</>` icon button in the header of the Agent Composer and Agent Chat views.
- **Interaction:** Clicking the icon opens a **Modal Dialog**.
- **Content:**
    - **Endpoint URL:** The specific POST endpoint for the current agent.
    - **Authentication:** Instructions for using the `X-Forge-Api-Key` header.
    - **Request Body:** Detailed JSON schema for inputs.
    - **Example Code:**
        - A `curl` command with a "Copy" button.
        - Snippets for JavaScript/TypeScript and Python.
    - **Response Schema:** Information on the streaming response format.

### 3. Execution API
- **Endpoint:** `POST /api/v1/agents/[agent-name]/execute`
- **Authentication:** Requires `X-Forge-Api-Key` in headers.
- **Streaming:** The API must support Server-Sent Events (SSE) to mirror the Forge chat experience.
- **Session Handling:** 
    - If a `session_id` is provided, the API uses/resumes that session.
    - If not provided, a new session is created.
    - New sessions must follow the naming convention: `<key-name>-<session-id>`.

### 4. Visibility & Debugging
- Sessions generated via API keys must appear in the standard Forge "Sessions" panel.
- Full trace, event, and debug information must be available for these sessions, just like native chat sessions.

## Non-Functional Requirements
- **Security:** API keys must be handled server-side by the consuming application.
- **Performance:** API overhead should be minimal to maintain real-time streaming feel.
- **Reliability:** API key validation must be robust against injection and timing attacks.

## Acceptance Criteria
- [ ] Users can navigate to **Settings > API Keys** and create a key named "MobileApp".
- [ ] Users can click `</>` on an agent named "Assistant" and see a `curl` command that includes the "Assistant" endpoint.
- [ ] An external POST request using the "MobileApp" key creates a session in Forge named `MobileApp-<uuid>`.
- [ ] The external application receives a streaming response successfully.
- [ ] The Forge UI displays the real-time traces of the external request.

## Out of Scope
- Creating or editing API keys directly from the Agent Composer/Chat view.
- Public/Client-side SDKs.
- Webhook callbacks (streaming only).