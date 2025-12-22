# Specification: Agent Task Scheduling & Management

## 1. Overview
Implement a robust scheduling system that allows users to send automated "notes" (prompts/messages) to any agent on the platform at a specific time or on a recurring schedule. This feature includes a central management dashboard, integrated views within individual agent interfaces, and deep integration with the session debugging system.

## 2. Functional Requirements

### 2.1 Scheduler Dashboard (Global)
*   A standalone page to view, create, edit, and delete all scheduled tasks across the platform.
*   Filter tasks by target agent, status (pending, recurring, completed), and date range.
*   Provide a clear list or calendar view of upcoming executions.

### 2.2 Per-Agent Scheduling View
*   Integrated section within each agent's chat interface showing tasks scheduled specifically for that agent.
*   Ability to create a new scheduled task pre-filled with the current agent as the target.

### 2.3 Task Definition
*   **Target Agent:** Select from any registered agent (including the orchestrator).
*   **Message:** The prompt/note content to be sent to the agent.
*   **Timing:** 
    *   One-time execution at a specific timestamp.
    *   Recurring intervals (Daily, Weekly, Monthly).
*   **Context:** Optional JSON metadata to pass along with the note.
*   **Notifications:** Toggle for success/failure notifications to the user.

### 2.4 Backend Execution & Debugging
*   A background process to monitor and trigger tasks when due.
*   **Session Linking:** Every task execution must generate a session that can be viewed and debugged from the existing debug panel in the agent chat UI.
*   Reliable handling of recurring tasks (calculating the next run time after completion).
*   Logging of execution results (success/error) for auditing in the dashboard.

## 3. Technical Requirements
*   **Persistence:** New database tables `scheduled_tasks` and `task_execution_logs`.
*   **Backend:** Next.js API routes for task management; a background worker (e.g., node-cron) for execution.
*   **UI:** React components for the scheduler dashboard and the agent-integrated view.

## 4. Acceptance Criteria
1.  User can schedule a note to be sent to "Agent A" in 10 minutes.
2.  The note is successfully "delivered" to the agent's session at the correct time.
3.  User can see the task listed in both the global dashboard and Agent A's specific view.
4.  User can click on a past execution in the dashboard and jump to the debug session in the chat UI.
5.  User can set a daily recurring task and verify the "Next Run" time updates correctly.
6.  User receives a notification if a task fails to execute.

## 5. Out of Scope
*   Advanced CRON expression editing for users (sticking to simple interval presets initially).
*   Scheduling tasks for external non-agent systems.
