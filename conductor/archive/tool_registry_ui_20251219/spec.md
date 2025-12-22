# Track Spec: Tool Registry UI

## 1. Goal
Implement a dedicated user interface within the Visual Builder (AgentComposer) to manage, create, and edit custom tools. This UI will interface with the "Meta-Agent" (Builder Agent) and "Forge" sub-agent backend to provide a seamless experience for defining new agent capabilities.

## 2. Core Features
*   **Tool List View:** Display all available tools (custom and system) for a specific project/agent.
*   **Tool Creation Wizard:** A guided flow to define a new tool (name, description, schema) and generate its implementation via the Forge agent.
*   **Tool Editor:** A code/schema editor (using Monaco Editor) to refine tool definitions.
*   **Registration Integration:** Mechanisms to register the new tool with the ADK runtime.

## 3. User Experience
*   **Access:** A new "Tools" tab or panel within the existing AgentComposer.
*   **Interaction:**
    1.  User clicks "Add Tool".
    2.  User describes the tool in natural language (e.g., "Get stock price for a ticker").
    3.  The UI calls the Builder/Forge agent to generate the tool code.
    4.  User reviews the generated Python/Typescript code and JSON schema.
    5.  User saves the tool, making it available to agents in the project.

## 4. Technical Requirements
*   **Frontend:** React components integrated into `app/components/AgentComposer`.
*   **State Management:** Leverage existing hooks (likely `useAgent` or similar) to fetch and update tool lists.
*   **API:** Interact with the existing `/api/agents/[name]/assistant` (or a new dedicated endpoint) to trigger tool generation.
*   **Validation:** Ensure tool names and schemas are valid before saving.

## 5. Progress Note
Significant backend progress (Meta-Agent, Forge sub-agent, Genkit tools) has already been made. This track focuses on the **UI/UX layer** and connecting it to these existing backend services.
