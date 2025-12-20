# Tech Stack: Prometheus Forge

## 1. Core Framework & Language
*   **Frontend/Backend:** [Next.js](https://nextjs.org/) (App Router architecture)
*   **Language:** [TypeScript](https://www.typescriptlang.org/) (Strict mode)
*   **State Management:** React Context and Hooks
*   **Runtime:** Node.js (Latest LTS)

## 2. AI & Agent Infrastructure
*   **Agent Engine:** [Google ADK](https://github.com/google/ai-delivery-kit) (v1.21+) - Core execution engine for YAML-defined agents.
*   **Orchestration & Tools:** [Google Genkit](https://firebase.google.com/docs/genkit) - Used for robust infrastructure tools and fallback agents.
*   **Interoperability:** [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) - Standardized interface for exposing agents as tools and connecting to external clients.
*   **Models:** Multi-model support via ADK/LiteLLM (Gemini 3.0, Claude 3.5, OpenAI).

## 3. Data & Storage
*   **Primary Database:** [PostgreSQL](https://www.postgresql.org/) (Hosted on Google Cloud SQL)
*   **Driver:** `pg` (node-postgres)
*   **Storage:** [Google Cloud Storage](https://cloud.google.com/storage) (for artifacts and large file persistence)
*   **Schema Management:** SQL Migrations (located in `/migrations`)

## 4. UI & Styling
*   **CSS Framework:** [Tailwind CSS](https://tailwindcss.com/)
*   **Icons:** [Lucide React](https://lucide.dev/)
*   **Editors:** [Monaco Editor](https://microsoft.github.io/monaco-editor/) (for YAML/Agent editing)
*   **Components:** Custom design system using semantic tokens (`success`, `warning`, `info`, `destructive`).

## 5. Development & Operations
*   **Version Control:** Git
*   **CI/CD:** [Google Cloud Build](https://cloud.google.com/build)
*   **Containerization:** Docker
*   **Testing:**
    *   **E2E:** [Playwright](https://playwright.dev/)
    *   **Unit/Integration:** [Vitest](https://vitest.dev/) and `tsx`
*   **Linting:** ESLint
