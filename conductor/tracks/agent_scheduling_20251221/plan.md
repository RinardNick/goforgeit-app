# Implementation Plan: Agent Task Scheduling & Management

## Phase 1: Database Schema & Core Persistence
- [ ] Task: Create database migration for `scheduled_tasks` and `task_execution_logs`.
    - [ ] Subtask: Define `scheduled_tasks` table (id, user_id, target_agent_id, message, timing_type, interval, next_run_at, context_json, notify_on_failure, status).
    - [ ] Subtask: Define `task_execution_logs` table (id, task_id, session_id, executed_at, result_status, error_message).
- [ ] Task: Implement `lib/db/tasks.ts` for CRUD operations.
    - [ ] Subtask: Write unit tests for creating, reading, updating, and deleting tasks.
    - [ ] Subtask: Implement `createTask`, `updateTask`, `listUserTasks`, `getTaskById`.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Database Schema & Core Persistence' (Protocol in workflow.md)

## Phase 2: Background Execution Engine
- [ ] Task: Implement Task Triggering Logic.
    - [ ] Subtask: Create a service/function that finds tasks due for execution.
    - [ ] Subtask: Implement session creation logic: Each execution must create or resume a session so it's visible in debug panels.
    - [ ] Subtask: Implement the "Send Note to Agent" logic (via internal API/ADK call), ensuring it writes to the created session.
    - [ ] Subtask: Write unit tests for the execution logic (mocking the agent delivery).
- [ ] Task: Implement Recurrence Logic.
    - [ ] Subtask: Write logic to calculate `next_run_at` for recurring tasks (Daily, Weekly, etc.).
    - [ ] Subtask: Write unit tests for interval calculations.
- [ ] Task: Set up the Background Runner.
    - [ ] Subtask: Integrate a background worker (e.g., node-cron) into the Next.js server start or a dedicated script.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Background Execution Engine' (Protocol in workflow.md)

## Phase 3: Global Scheduler Dashboard
- [ ] Task: Create `/scheduler` page UI.
    - [ ] Subtask: Implement the task list view with filtering/sorting.
    - [ ] Subtask: Build the "Schedule New Task" form/dialog.
- [ ] Task: Implement Task Management Actions.
    - [ ] Subtask: Add "Edit" and "Cancel/Delete" functionality to the dashboard.
    - [ ] Subtask: Integrate with `lib/db/tasks.ts` API routes.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Global Scheduler Dashboard' (Protocol in workflow.md)

## Phase 4: Integrated Per-Agent Scheduling
- [ ] Task: Enhance Agent Chat Interface.
    - [ ] Subtask: Add a "Schedules" section/tab to the existing agent views.
    - [ ] Subtask: Filter global tasks to show only those targeting the current agent.
- [ ] Task: Add "Schedule for this Agent" Shortcut.
    - [ ] Subtask: Implement a quick-action button in the chat to schedule a note for the active agent.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Integrated Per-Agent Scheduling' (Protocol in workflow.md)

## Phase 5: Notifications & Polish
- [ ] Task: Implement Success/Failure Notifications.
    - [ ] Subtask: Add logic to trigger user alerts/emails based on task results.
- [ ] Task: Final End-to-End Testing.
    - [ ] Subtask: Verify recurring task execution over multiple "days" (simulated).
    - [ ] Subtask: UI/UX responsive polish.
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Polish & Final Integration' (Protocol in workflow.md)
