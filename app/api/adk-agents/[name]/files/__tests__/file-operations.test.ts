/**
 * Integration Tests for ADK File Operations API
 *
 * Converted from E2E tests (e2e/adk-visual-builder/phase2-agent-rename.spec.ts, phase7-delete-project.spec.ts)
 * Tests the file operations API routes directly without browser overhead.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { GET as listFiles, PUT as updateFile, POST as createFile, PATCH as renameFile, DELETE as deleteFile } from '../route';

const TEST_PROJECT = 'test-file-ops-project';
const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');
const TEST_AGENT_DIR = path.join(ADK_AGENTS_DIR, TEST_PROJECT);

// Helper to create a NextRequest mock
function createMockRequest(method: string, url?: string, body?: unknown) {
  const headers = new Headers();
  headers.set('content-type', 'application/json');

  const request: any = {
    method,
    url: url || `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/files`,
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

describe('ADK File Operations - Integration Tests', () => {
  beforeEach(async () => {
    await cleanupTestDir();
    await ensureAgentDir();
  });

  afterEach(async () => {
    await cleanupTestDir();
  });

  describe('GET /api/adk-agents/[name]/files - List Files', () => {
    it('returns 404 when agent directory does not exist', async () => {
      // GIVEN: No agent directory
      await cleanupTestDir();

      // WHEN: List files
      const request = createMockRequest('GET');
      const response = await listFiles(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 404
      assert.strictEqual(response.status, 404);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('not found'));
    });

    it('returns empty array when agent directory has no YAML files', async () => {
      // GIVEN: Empty agent directory
      await ensureAgentDir();

      // WHEN: List files
      const request = createMockRequest('GET');
      const response = await listFiles(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return empty files array
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.agentName, TEST_PROJECT);
      assert.ok(Array.isArray(data.files));
      assert.strictEqual(data.files.length, 0);
    });

    it('returns list of YAML files with content', async () => {
      // GIVEN: Agent directory with YAML files
      const rootAgentYaml = `name: root_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Root agent
sub_agents: []
tools: []
`;

      const helperYaml = `name: helper_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Helper agent
`;

      await createYamlFile('root_agent.yaml', rootAgentYaml);
      await createYamlFile('helper_agent.yaml', helperYaml);

      // WHEN: List files
      const request = createMockRequest('GET');
      const response = await listFiles(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return both files
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.files.length, 2);

      const rootFile = data.files.find((f: any) => f.filename === 'root_agent.yaml');
      const helperFile = data.files.find((f: any) => f.filename === 'helper_agent.yaml');

      assert.ok(rootFile, 'Should have root_agent.yaml');
      assert.strictEqual(rootFile.yaml, rootAgentYaml);

      assert.ok(helperFile, 'Should have helper_agent.yaml');
      assert.strictEqual(helperFile.yaml, helperYaml);
    });
  });

  describe('PUT /api/adk-agents/[name]/files - Update File', () => {
    it('updates an existing YAML file', async () => {
      // GIVEN: Existing YAML file
      const originalYaml = `name: original
agent_class: LlmAgent
`;
      await createYamlFile('agent.yaml', originalYaml);

      // WHEN: Update the file
      const updatedYaml = `name: updated
agent_class: LlmAgent
description: Updated description
`;

      const request = createMockRequest('PUT', undefined, {
        filename: 'agent.yaml',
        yaml: updatedYaml,
      });
      const response = await updateFile(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return success
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.filename, 'agent.yaml');

      // AND: File should be updated on disk
      const fileContent = await fs.readFile(path.join(TEST_AGENT_DIR, 'agent.yaml'), 'utf-8');
      assert.strictEqual(fileContent, updatedYaml);
    });

    it('validates request body - missing filename', async () => {
      // WHEN: Update without filename
      const request = createMockRequest('PUT', undefined, {
        yaml: 'name: test',
      });
      const response = await updateFile(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('required'));
    });

    it('validates request body - missing yaml', async () => {
      // WHEN: Update without yaml content
      const request = createMockRequest('PUT', undefined, {
        filename: 'agent.yaml',
      });
      const response = await updateFile(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
    });

    it('prevents directory traversal attacks', async () => {
      // WHEN: Try to write file outside agent directory
      const request = createMockRequest('PUT', undefined, {
        filename: '../../secrets.yaml',
        yaml: 'malicious: content',
      });
      const response = await updateFile(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400 invalid filename
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('Invalid filename'));
    });
  });

  describe('POST /api/adk-agents/[name]/files - Create File', () => {
    it('creates a new agent file with structured data', async () => {
      // WHEN: Create a new agent file
      const request = createMockRequest('POST', undefined, {
        name: 'my_agent',
        agentClass: 'LlmAgent',
        model: 'gemini-2.5-flash',
        description: 'My test agent',
      });
      const response = await createFile(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return success
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.filename, 'my_agent.yaml');
      assert.ok(data.yaml);

      // AND: File should exist on disk
      const filePath = path.join(TEST_AGENT_DIR, 'my_agent.yaml');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      assert.ok(fileContent.includes('name: my_agent'));
      assert.ok(fileContent.includes('agent_class: LlmAgent'));
      assert.ok(fileContent.includes('model: gemini-2.5-flash'));
    });

    it('generates unique filename if file already exists', async () => {
      // GIVEN: Existing agent file
      await createYamlFile('my_agent.yaml', 'name: my_agent\nagent_class: LlmAgent\n');

      // WHEN: Create agent with same name
      const request = createMockRequest('POST', undefined, {
        name: 'my_agent',
        agentClass: 'LlmAgent',
      });
      const response = await createFile(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should create file with incremented name
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.filename, 'my_agent_1.yaml');

      // AND: Both files should exist
      const file1Exists = await fs.access(path.join(TEST_AGENT_DIR, 'my_agent.yaml')).then(() => true).catch(() => false);
      const file2Exists = await fs.access(path.join(TEST_AGENT_DIR, 'my_agent_1.yaml')).then(() => true).catch(() => false);
      assert.strictEqual(file1Exists, true);
      assert.strictEqual(file2Exists, true);
    });

    it('validates request body - missing name', async () => {
      // WHEN: Create without name
      const request = createMockRequest('POST', undefined, {
        agentClass: 'LlmAgent',
      });
      const response = await createFile(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('required'));
    });

    it('validates request body - missing agentClass', async () => {
      // WHEN: Create without agentClass
      const request = createMockRequest('POST', undefined, {
        name: 'test_agent',
      });
      const response = await createFile(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
    });

    it('returns 404 when agent directory does not exist', async () => {
      // GIVEN: No agent directory
      await cleanupTestDir();

      // WHEN: Try to create file
      const request = createMockRequest('POST', undefined, {
        name: 'test_agent',
        agentClass: 'LlmAgent',
      });
      const response = await createFile(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 404
      assert.strictEqual(response.status, 404);
      const data = await response.json();
      assert.ok(data.error);
    });
  });

  describe('PATCH /api/adk-agents/[name]/files - Rename File', () => {
    it('renames an agent file', async () => {
      // GIVEN: Existing agent file
      const originalYaml = `name: old_name
agent_class: LlmAgent
`;
      await createYamlFile('old_name.yaml', originalYaml);

      // WHEN: Rename the file
      const request = createMockRequest('PATCH', undefined, {
        oldFilename: 'old_name.yaml',
        newFilename: 'new_name.yaml',
      });
      const response = await renameFile(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return success
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.oldFilename, 'old_name.yaml');
      assert.strictEqual(data.newFilename, 'new_name.yaml');

      // AND: Old file should not exist
      const oldFileExists = await fs.access(path.join(TEST_AGENT_DIR, 'old_name.yaml')).then(() => true).catch(() => false);
      assert.strictEqual(oldFileExists, false);

      // AND: New file should exist with same content
      const newFileContent = await fs.readFile(path.join(TEST_AGENT_DIR, 'new_name.yaml'), 'utf-8');
      assert.strictEqual(newFileContent, originalYaml);
    });

    it('updates config_path references in parent files when renaming', async () => {
      // GIVEN: Parent agent referencing a child agent
      const childYaml = `name: child
agent_class: LlmAgent
`;
      const parentYaml = `name: parent
agent_class: LlmAgent
sub_agents:
  - config_path: child.yaml
`;

      await createYamlFile('child.yaml', childYaml);
      await createYamlFile('parent.yaml', parentYaml);

      // WHEN: Rename the child file
      const request = createMockRequest('PATCH', undefined, {
        oldFilename: 'child.yaml',
        newFilename: 'renamed_child.yaml',
      });
      const response = await renameFile(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return success
      assert.strictEqual(response.status, 200);

      // AND: Parent file should have updated config_path
      const updatedParentContent = await fs.readFile(path.join(TEST_AGENT_DIR, 'parent.yaml'), 'utf-8');
      assert.ok(updatedParentContent.includes('config_path: renamed_child.yaml'));
      assert.ok(!updatedParentContent.includes('config_path: child.yaml'));
    });

    it('returns 404 if old file does not exist', async () => {
      // WHEN: Try to rename non-existent file
      const request = createMockRequest('PATCH', undefined, {
        oldFilename: 'nonexistent.yaml',
        newFilename: 'new.yaml',
      });
      const response = await renameFile(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 404
      assert.strictEqual(response.status, 404);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('not found'));
    });

    it('returns 409 if new filename already exists', async () => {
      // GIVEN: Two existing files
      await createYamlFile('file1.yaml', 'name: file1\n');
      await createYamlFile('file2.yaml', 'name: file2\n');

      // WHEN: Try to rename file1 to file2
      const request = createMockRequest('PATCH', undefined, {
        oldFilename: 'file1.yaml',
        newFilename: 'file2.yaml',
      });
      const response = await renameFile(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 409 conflict
      assert.strictEqual(response.status, 409);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('already exists'));
    });

    it('prevents renaming root_agent.yaml', async () => {
      // GIVEN: root_agent.yaml file
      await createYamlFile('root_agent.yaml', 'name: root\n');

      // WHEN: Try to rename root_agent.yaml
      const request = createMockRequest('PATCH', undefined, {
        oldFilename: 'root_agent.yaml',
        newFilename: 'something_else.yaml',
      });
      const response = await renameFile(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('Cannot rename'));
    });

    it('prevents directory traversal attacks', async () => {
      // GIVEN: Existing file
      await createYamlFile('agent.yaml', 'name: agent\n');

      // WHEN: Try to rename to path outside directory
      const request = createMockRequest('PATCH', undefined, {
        oldFilename: 'agent.yaml',
        newFilename: '../../evil.yaml',
      });
      const response = await renameFile(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('Invalid filename'));
    });
  });

  describe('DELETE /api/adk-agents/[name]/files - Delete File', () => {
    it('deletes an agent file', async () => {
      // GIVEN: Existing agent file
      await createYamlFile('delete_me.yaml', 'name: delete_me\n');

      // WHEN: Delete the file
      const request = createMockRequest('DELETE', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/files?filename=delete_me.yaml`);
      const response = await deleteFile(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return success
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.filename, 'delete_me.yaml');

      // AND: File should be deleted from disk
      const fileExists = await fs.access(path.join(TEST_AGENT_DIR, 'delete_me.yaml')).then(() => true).catch(() => false);
      assert.strictEqual(fileExists, false);
    });

    it('returns 404 if file does not exist', async () => {
      // WHEN: Try to delete non-existent file
      const request = createMockRequest('DELETE', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/files?filename=nonexistent.yaml`);
      const response = await deleteFile(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 404
      assert.strictEqual(response.status, 404);
      const data = await response.json();
      assert.ok(data.error);
    });

    it('requires filename query parameter', async () => {
      // WHEN: Delete without filename
      const request = createMockRequest('DELETE');
      const response = await deleteFile(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('required'));
    });

    it('prevents deleting root_agent.yaml', async () => {
      // GIVEN: root_agent.yaml file
      await createYamlFile('root_agent.yaml', 'name: root\n');

      // WHEN: Try to delete root_agent.yaml
      const request = createMockRequest('DELETE', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/files?filename=root_agent.yaml`);
      const response = await deleteFile(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('Cannot delete'));
    });

    it('prevents directory traversal attacks', async () => {
      // WHEN: Try to delete file outside directory
      const request = createMockRequest('DELETE', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/files?filename=../../secrets.yaml`);
      const response = await deleteFile(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('Invalid filename'));
    });
  });
});
