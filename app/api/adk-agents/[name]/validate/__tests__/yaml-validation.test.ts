/**
 * Integration Tests for ADK YAML Validation API
 *
 * Converted from E2E tests (e2e/adk-visual-builder/phase6-validation.spec.ts)
 * Tests the validation API routes directly without browser overhead.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { GET as validateProject } from '../route';

const TEST_PROJECT = 'test-validation-project';
const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');
const TEST_AGENT_DIR = path.join(ADK_AGENTS_DIR, TEST_PROJECT);

// Helper to create a NextRequest mock
function createMockRequest() {
  return {
    method: 'GET',
    url: `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/validate`,
    headers: new Headers(),
  } as any;
}

// Helper to create params
async function createParams(params: Record<string, string>) {
  return Promise.resolve(params);
}

// Helper to create test YAML file
async function createYamlFile(filename: string, yaml: string) {
  await fs.mkdir(TEST_AGENT_DIR, { recursive: true });
  await fs.writeFile(path.join(TEST_AGENT_DIR, filename), yaml, 'utf-8');
}

// Helper to cleanup test directory
async function cleanupTestDir() {
  try {
    await fs.rm(TEST_AGENT_DIR, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }
}

describe('ADK YAML Validation - Integration Tests', () => {
  beforeEach(async () => {
    await cleanupTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir();
  });

  describe('GET /api/adk-agents/[name]/validate - Detect Broken References', () => {
    it('detects broken sub_agents config_path reference', async () => {
      // GIVEN: Agent with broken sub_agents reference
      const brokenAgentYaml = `name: broken_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Agent with broken reference
sub_agents:
  - config_path: non_existent_agent.yaml
`;

      await createYamlFile('broken_agent.yaml', brokenAgentYaml);

      // WHEN: Validate the project
      const request = createMockRequest();
      const response = await validateProject(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should detect the broken reference
      assert.strictEqual(data.valid, false);
      assert.ok(data.totalErrors >= 1, 'Should have at least 1 error');
      assert.ok(data.results['broken_agent.yaml']);
      assert.strictEqual(data.results['broken_agent.yaml'].valid, false);

      const errors = data.results['broken_agent.yaml'].errors;
      assert.ok(errors.length > 0);
      const brokenRefError = errors.find((e: any) => e.type === 'broken_reference');
      assert.ok(brokenRefError, 'Should have broken_reference error');
      assert.ok(brokenRefError.message.includes('non_existent_agent.yaml'));
      assert.ok(brokenRefError.message.includes('not found'));
    });

    it('detects broken AgentTool config_path reference', async () => {
      // GIVEN: Agent with broken AgentTool reference
      const brokenToolAgentYaml = `name: broken_tool_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Agent with broken tool reference
tools:
  - name: AgentTool
    args:
      agent:
        config_path: missing_tool_agent.yaml
`;

      await createYamlFile('broken_tool_agent.yaml', brokenToolAgentYaml);

      // WHEN: Validate the project
      const request = createMockRequest();
      const response = await validateProject(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should detect the broken reference
      assert.strictEqual(data.valid, false);
      assert.ok(data.totalErrors >= 1, 'Should have at least 1 error');

      const errors = data.results['broken_tool_agent.yaml'].errors;
      const brokenRefError = errors.find((e: any) => e.type === 'broken_reference');
      assert.ok(brokenRefError);
      assert.ok(brokenRefError.message.includes('missing_tool_agent.yaml'));
    });

    it('validation passes when all references exist', async () => {
      // GIVEN: Two agents with valid references
      const helperAgentYaml = `name: helper_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Helper agent
`;

      const mainAgentYaml = `name: main_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Main agent with valid reference
sub_agents:
  - config_path: helper_agent.yaml
`;

      await createYamlFile('helper_agent.yaml', helperAgentYaml);
      await createYamlFile('main_agent.yaml', mainAgentYaml);

      // WHEN: Validate the project
      const request = createMockRequest();
      const response = await validateProject(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Reference validation should pass (no broken_reference errors)
      assert.strictEqual(data.totalAgents, 2);

      // Check that there are no broken_reference errors
      const helperErrors = data.results['helper_agent.yaml'].errors;
      const mainErrors = data.results['main_agent.yaml'].errors;

      const helperBrokenRefs = helperErrors.filter((e: any) => e.type === 'broken_reference');
      const mainBrokenRefs = mainErrors.filter((e: any) => e.type === 'broken_reference');

      assert.strictEqual(helperBrokenRefs.length, 0, 'helper_agent should have no broken references');
      assert.strictEqual(mainBrokenRefs.length, 0, 'main_agent should have no broken references');
    });

    it('detects multiple broken references in one file', async () => {
      // GIVEN: Agent with multiple broken references
      const multipleErrorsYaml = `name: multi_broken_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Agent with multiple broken references
sub_agents:
  - config_path: missing_agent_1.yaml
  - config_path: missing_agent_2.yaml
tools:
  - name: AgentTool
    args:
      agent:
        config_path: missing_tool.yaml
`;

      await createYamlFile('multi_broken_agent.yaml', multipleErrorsYaml);

      // WHEN: Validate the project
      const request = createMockRequest();
      const response = await validateProject(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should detect all broken references
      assert.strictEqual(data.valid, false);
      assert.ok(data.totalErrors >= 3); // At least 3 broken references

      const errors = data.results['multi_broken_agent.yaml'].errors;
      const brokenRefErrors = errors.filter((e: any) => e.type === 'broken_reference');
      assert.ok(brokenRefErrors.length >= 3);
    });

    it('handles relative path normalization (./file.yaml)', async () => {
      // GIVEN: Agent with ./ prefix in config_path
      const helperYaml = `name: helper
agent_class: LlmAgent
model: gemini-2.5-flash
`;

      const mainYaml = `name: main
agent_class: LlmAgent
model: gemini-2.5-flash
sub_agents:
  - config_path: ./helper.yaml
`;

      await createYamlFile('helper.yaml', helperYaml);
      await createYamlFile('main.yaml', mainYaml);

      // WHEN: Validate the project
      const request = createMockRequest();
      const response = await validateProject(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should normalize and pass reference validation (no broken_reference errors)
      const mainErrors = data.results['main.yaml'].errors;
      const brokenRefs = mainErrors.filter((e: any) => e.type === 'broken_reference');
      assert.strictEqual(brokenRefs.length, 0, 'Should normalize path and find helper.yaml');
    });
  });

  describe('GET /api/adk-agents/[name]/validate - Error Handling', () => {
    it('returns 404 when agent directory does not exist', async () => {
      // WHEN: Validate non-existent project
      const request = createMockRequest();
      const response = await validateProject(request, { params: createParams({ name: 'non-existent-project' }) });
      const data = await response.json();

      // THEN: Should return 404
      assert.strictEqual(response.status, 404);
      assert.ok(data.error);
      assert.ok(data.error.includes('not found'));
    });

    it('handles empty agent directory', async () => {
      // GIVEN: Empty agent directory
      await fs.mkdir(TEST_AGENT_DIR, { recursive: true });

      // WHEN: Validate empty project
      const request = createMockRequest();
      const response = await validateProject(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return valid (no files to validate)
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.valid, true);
      assert.strictEqual(data.totalAgents, 0);
      assert.strictEqual(data.totalErrors, 0);
    });
  });

  // Note: Schema validation tests are skipped because they depend on external Python validator
  // which may not be available in the test environment. The validate endpoint calls
  // /api/validate-agent which uses a Python script for Pydantic schema validation.
});
