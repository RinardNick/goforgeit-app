# Specification: Centralized Tool Registry

## 1. Overview
Create a platform-wide Tool Registry that serves as a central repository for all executable tools (Custom Python Tools and MCP Servers). This allows tools created in one project or agent to be discovered and reused across the entire platform, reducing duplication and maintenance overhead.

## 2. Functional Requirements

### 2.1 Management UI (Standalone Page)
*   A dedicated view to browse all registered tools and MCP servers.
*   Ability to register new tools by pointing to existing agent files or providing MCP server configurations.
*   Tools are displayed once; MCP servers are displayed as a single entity rather than individual tools.
*   Edit metadata (manually or via AI) and revoke/delete tools from the registry.

### 2.2 Integration UI (Agent Builder)
*   Enhanced "Tools" panel within the Agent Builder.
*   "Browse Library" tab to search and filter tools from the global registry.
*   One-click "Add to Agent" which handles the necessary configuration to use the shared tool.

### 2.3 Persistence & Metadata
*   **Database:** A new `tool_registry` table in PostgreSQL.
    *   Fields: `id`, `name`, `type` (CUSTOM/MCP), `description`, `config` (JSONB for MCP URLs or file paths), `org_id`, `category`, `tags` (JSONB), `source_project_id`.
*   **Auto-Categorization:** On registration, the tool's code or definition is sent to an LLM to generate descriptive categories and keywords.

### 2.4 Architecture: Centralize & Link
*   Custom tools are moved from agent-specific directories to a shared directory (e.g., `lib/adk/shared/tools`).
*   Agent configurations are updated to reference tools from this central location.
*   MCP configurations are stored in the database and injected into agent runtimes dynamically.

## 3. Technical Requirements
*   **Backend:** Next.js API routes for CRUD operations on `tool_registry`.
*   **Storage:** Refactor ADK file logic to support a `shared/` directory structure.
*   **AI:** Integrate with the existing Genkit/LLM infrastructure for categorization tasks.

## 4. Acceptance Criteria
1.  User can register a tool from "Agent A" into the Registry.
2.  The tool is automatically assigned tags/categories by an LLM.
3.  User can open "Agent B" and select that tool from the library.
4.  "Agent B" can successfully execute the tool without manual code copying.
5.  MCP servers appear as a single manageable entry in the library.

## 5. Out of Scope
*   Version control for individual tool files (initially).
*   Fine-grained permissions for tools within the same Organization.
