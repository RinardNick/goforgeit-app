/**
 * Integration Tests for ADK Connections API
 *
 * Converted from E2E tests (e2e/adk-visual-builder/phase3-connections.spec.ts)
 * Tests the connections API routes directly without browser overhead.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';
import { POST as createConnection, PATCH as reorderConnection, DELETE as deleteConnection } from '../route';

const TEST_PROJECT = 'test-connections-project';
const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');
const TEST_AGENT_DIR = path.join(ADK_AGENTS_DIR, TEST_PROJECT);

// Helper to create a NextRequest mock
function createMockRequest(method: string, url?: string, body?: unknown) {
  const headers = new Headers();
  headers.set('content-type', 'application/json');

  const request: any = {
    method,
    url: url || `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/connections`,
    headers,
  };

  if (body) {
    request.json = async () => body;
  }

  return request;
}

// Helper to create params
async function createParams(params: Record<string, string>) {
  return Promise.resolve(params);
}

// Helper to cleanup test directory
async function cleanupTestDir() {
  try {
    await fs.rm(TEST_AGENT_DIR, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }
}

// Helper to ensure agent directory exists
async function ensureAgentDir() {
  await fs.mkdir(TEST_AGENT_DIR, { recursive: true });
}

// Helper to create a test YAML file
async function createYamlFile(filename: string, yaml: string) {
  await fs.writeFile(path.join(TEST_AGENT_DIR, filename), yaml, 'utf-8');
}

// Helper to read YAML file
async function readYamlFile(filename: string) {
  const content = await fs.readFile(path.join(TEST_AGENT_DIR, filename), 'utf-8');
  return YAML.parse(content);
}

describe('ADK Connections - Integration Tests', () => {
  beforeEach(async () => {
    await cleanupTestDir();
    await ensureAgentDir();
  });

  afterEach(async () => {
    await cleanupTestDir();
  });

  describe('POST /api/adk-agents/[name]/connections - Create Connection', () => {
    it('creates a connection between parent and child agents', async () => {
      // GIVEN: Parent and child agent files
      const parentYaml = `name: parent
agent_class: LlmAgent
model: gemini-2.5-flash
`;

      const childYaml = `name: child
agent_class: LlmAgent
model: gemini-2.5-flash
`;

      await createYamlFile('parent.yaml', parentYaml);
      await createYamlFile('child.yaml', childYaml);

      // WHEN: Create connection
      const request = createMockRequest('POST', undefined, {
        parentFilename: 'parent.yaml',
        childFilename: 'child.yaml',
      });
      const response = await createConnection(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return success
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.parentFilename, 'parent.yaml');
      assert.strictEqual(data.childFilename, 'child.yaml');

      // AND: Parent YAML should have sub_agent
      const updatedParent = await readYamlFile('parent.yaml');
      assert.ok(updatedParent.sub_agents);
      assert.strictEqual(updatedParent.sub_agents.length, 1);
      assert.strictEqual(updatedParent.sub_agents[0].config_path, 'child.yaml');
    });

    it('uses relative filename in config_path (not full path)', async () => {
      // GIVEN: Parent and child files
      await createYamlFile('parent.yaml', 'name: parent\nagent_class: LlmAgent\n');
      await createYamlFile('child.yaml', 'name: child\nagent_class: LlmAgent\n');

      // WHEN: Create connection
      const request = createMockRequest('POST', undefined, {
        parentFilename: 'parent.yaml',
        childFilename: 'child.yaml',
      });
      await createConnection(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: config_path should be relative filename only
      const updatedParent = await readYamlFile('parent.yaml');
      assert.strictEqual(updatedParent.sub_agents[0].config_path, 'child.yaml');
      assert.ok(!updatedParent.sub_agents[0].config_path.includes('/'));
    });

    it('creates multiple connections (multiple sub_agents entries)', async () => {
      // GIVEN: Parent and two children
      await createYamlFile('parent.yaml', 'name: parent\nagent_class: LlmAgent\n');
      await createYamlFile('child1.yaml', 'name: child1\nagent_class: LlmAgent\n');
      await createYamlFile('child2.yaml', 'name: child2\nagent_class: LlmAgent\n');

      // WHEN: Create two connections
      const req1 = createMockRequest('POST', undefined, {
        parentFilename: 'parent.yaml',
        childFilename: 'child1.yaml',
      });
      await createConnection(req1, { params: createParams({ name: TEST_PROJECT }) });

      const req2 = createMockRequest('POST', undefined, {
        parentFilename: 'parent.yaml',
        childFilename: 'child2.yaml',
      });
      await createConnection(req2, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Parent should have both sub_agents
      const updatedParent = await readYamlFile('parent.yaml');
      assert.strictEqual(updatedParent.sub_agents.length, 2);
      assert.strictEqual(updatedParent.sub_agents[0].config_path, 'child1.yaml');
      assert.strictEqual(updatedParent.sub_agents[1].config_path, 'child2.yaml');
    });

    it('returns 400 if connection already exists', async () => {
      // GIVEN: Existing connection
      await createYamlFile('parent.yaml', 'name: parent\nagent_class: LlmAgent\n');
      await createYamlFile('child.yaml', 'name: child\nagent_class: LlmAgent\n');

      const req1 = createMockRequest('POST', undefined, {
        parentFilename: 'parent.yaml',
        childFilename: 'child.yaml',
      });
      await createConnection(req1, { params: createParams({ name: TEST_PROJECT }) });

      // WHEN: Try to create same connection again
      const req2 = createMockRequest('POST', undefined, {
        parentFilename: 'parent.yaml',
        childFilename: 'child.yaml',
      });
      const response = await createConnection(req2, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('already exists'));
    });

    it('returns 404 if parent file not found', async () => {
      // GIVEN: Only child exists
      await createYamlFile('child.yaml', 'name: child\nagent_class: LlmAgent\n');

      // WHEN: Try to create connection with non-existent parent
      const request = createMockRequest('POST', undefined, {
        parentFilename: 'nonexistent.yaml',
        childFilename: 'child.yaml',
      });
      const response = await createConnection(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 404
      assert.strictEqual(response.status, 404);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('Parent file not found'));
    });

    it('returns 404 if child file not found', async () => {
      // GIVEN: Only parent exists
      await createYamlFile('parent.yaml', 'name: parent\nagent_class: LlmAgent\n');

      // WHEN: Try to create connection with non-existent child
      const request = createMockRequest('POST', undefined, {
        parentFilename: 'parent.yaml',
        childFilename: 'nonexistent.yaml',
      });
      const response = await createConnection(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 404
      assert.strictEqual(response.status, 404);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('Child file not found'));
    });

    it('validates request body - missing parentFilename', async () => {
      // WHEN: Create connection without parentFilename
      const request = createMockRequest('POST', undefined, {
        childFilename: 'child.yaml',
      });
      const response = await createConnection(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('required'));
    });

    it('validates request body - missing childFilename', async () => {
      // WHEN: Create connection without childFilename
      const request = createMockRequest('POST', undefined, {
        parentFilename: 'parent.yaml',
      });
      const response = await createConnection(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
    });
  });

  describe('PATCH /api/adk-agents/[name]/connections - Reorder Connection', () => {
    it('reorders sub_agent within parent array', async () => {
      // GIVEN: Parent with 3 sub_agents
      const parentYaml = `name: parent
agent_class: LlmAgent
sub_agents:
  - config_path: child1.yaml
  - config_path: child2.yaml
  - config_path: child3.yaml
`;
      await createYamlFile('parent.yaml', parentYaml);

      // WHEN: Move child3 from index 2 to index 0
      const request = createMockRequest('PATCH', undefined, {
        parentFilename: 'parent.yaml',
        childFilename: 'child3.yaml',
        newIndex: 0,
      });
      const response = await reorderConnection(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return success
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.oldIndex, 2);
      assert.strictEqual(data.newIndex, 0);

      // AND: Order should be updated
      const updatedParent = await readYamlFile('parent.yaml');
      assert.strictEqual(updatedParent.sub_agents[0].config_path, 'child3.yaml');
      assert.strictEqual(updatedParent.sub_agents[1].config_path, 'child1.yaml');
      assert.strictEqual(updatedParent.sub_agents[2].config_path, 'child2.yaml');
    });

    it('returns 404 if parent file not found', async () => {
      // WHEN: Try to reorder in non-existent parent
      const request = createMockRequest('PATCH', undefined, {
        parentFilename: 'nonexistent.yaml',
        childFilename: 'child.yaml',
        newIndex: 0,
      });
      const response = await reorderConnection(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 404
      assert.strictEqual(response.status, 404);
      const data = await response.json();
      assert.ok(data.error);
    });

    it('returns 404 if child not in sub_agents array', async () => {
      // GIVEN: Parent without the child in sub_agents
      await createYamlFile('parent.yaml', 'name: parent\nagent_class: LlmAgent\nsub_agents: []\n');

      // WHEN: Try to reorder non-existent child
      const request = createMockRequest('PATCH', undefined, {
        parentFilename: 'parent.yaml',
        childFilename: 'child.yaml',
        newIndex: 0,
      });
      const response = await reorderConnection(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 404
      assert.strictEqual(response.status, 404);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('not found'));
    });

    it('returns 400 if newIndex is out of bounds', async () => {
      // GIVEN: Parent with 2 sub_agents
      const parentYaml = `name: parent
agent_class: LlmAgent
sub_agents:
  - config_path: child1.yaml
  - config_path: child2.yaml
`;
      await createYamlFile('parent.yaml', parentYaml);

      // WHEN: Try to move to index 5 (out of bounds)
      const request = createMockRequest('PATCH', undefined, {
        parentFilename: 'parent.yaml',
        childFilename: 'child1.yaml',
        newIndex: 5,
      });
      const response = await reorderConnection(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('Invalid newIndex'));
    });
  });

  describe('DELETE /api/adk-agents/[name]/connections - Delete Connection', () => {
    it('deletes connection (removes config_path from parent YAML)', async () => {
      // GIVEN: Parent with sub_agent connection
      const parentYaml = `name: parent
agent_class: LlmAgent
sub_agents:
  - config_path: child.yaml
`;
      await createYamlFile('parent.yaml', parentYaml);
      await createYamlFile('child.yaml', 'name: child\nagent_class: LlmAgent\n');

      // WHEN: Delete the connection
      const request = createMockRequest('DELETE', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/connections?parentFilename=parent.yaml&childFilename=child.yaml`);
      const response = await deleteConnection(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return success
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);

      // AND: Parent YAML should have no sub_agents
      const updatedParent = await readYamlFile('parent.yaml');
      assert.ok(!updatedParent.sub_agents || updatedParent.sub_agents.length === 0);
    });

    it('deletes connection but does NOT delete the child agent file', async () => {
      // GIVEN: Parent with sub_agent connection
      const parentYaml = `name: parent
agent_class: LlmAgent
sub_agents:
  - config_path: child.yaml
`;
      await createYamlFile('parent.yaml', parentYaml);
      await createYamlFile('child.yaml', 'name: child\nagent_class: LlmAgent\n');

      // WHEN: Delete the connection
      const request = createMockRequest('DELETE', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/connections?parentFilename=parent.yaml&childFilename=child.yaml`);
      await deleteConnection(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Child file should still exist
      const childExists = await fs.access(path.join(TEST_AGENT_DIR, 'child.yaml')).then(() => true).catch(() => false);
      assert.strictEqual(childExists, true);
    });

    it('removes orphan sub_agents key when last connection is deleted', async () => {
      // GIVEN: Parent with only one sub_agent
      const parentYaml = `name: parent
agent_class: LlmAgent
model: gemini-2.5-flash
sub_agents:
  - config_path: child.yaml
`;
      await createYamlFile('parent.yaml', parentYaml);
      await createYamlFile('child.yaml', 'name: child\n');

      // WHEN: Delete the connection
      const request = createMockRequest('DELETE', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/connections?parentFilename=parent.yaml&childFilename=child.yaml`);
      await deleteConnection(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: sub_agents key should be removed entirely
      const updatedParent = await readYamlFile('parent.yaml');
      assert.ok(!updatedParent.sub_agents);
    });

    it('returns 404 if connection not found', async () => {
      // GIVEN: Parent without the child in sub_agents
      await createYamlFile('parent.yaml', 'name: parent\nagent_class: LlmAgent\n');

      // WHEN: Try to delete non-existent connection
      const request = createMockRequest('DELETE', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/connections?parentFilename=parent.yaml&childFilename=child.yaml`);
      const response = await deleteConnection(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 404
      assert.strictEqual(response.status, 404);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.notFound);
    });

    it('returns 404 if parent file not found', async () => {
      // WHEN: Try to delete connection from non-existent parent
      const request = createMockRequest('DELETE', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/connections?parentFilename=nonexistent.yaml&childFilename=child.yaml`);
      const response = await deleteConnection(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 404
      assert.strictEqual(response.status, 404);
      const data = await response.json();
      assert.ok(data.error);
    });

    it('requires parentFilename query parameter', async () => {
      // WHEN: Delete without parentFilename
      const request = createMockRequest('DELETE', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/connections?childFilename=child.yaml`);
      const response = await deleteConnection(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('required'));
    });

    it('requires childFilename query parameter', async () => {
      // WHEN: Delete without childFilename
      const request = createMockRequest('DELETE', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/connections?parentFilename=parent.yaml`);
      const response = await deleteConnection(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
    });
  });
});
