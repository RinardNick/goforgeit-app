/**
 * Integration Tests for ADK Python Tools API
 *
 * Converted from E2E tests (e2e/adk-visual-builder/phase9.6-custom-python-tools.spec.ts)
 * Tests the Python tools API routes directly without browser overhead.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { GET as listTools, POST as createTool, PUT as updateTool, DELETE as deleteTool } from '../route';

const TEST_PROJECT = 'test-python-tools-project';
const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');
const TEST_AGENT_DIR = path.join(ADK_AGENTS_DIR, TEST_PROJECT);
const TEST_TOOLS_DIR = path.join(TEST_AGENT_DIR, 'tools');

// Helper to create a NextRequest mock
function createMockRequest(method: string, url?: string, body?: unknown) {
  const headers = new Headers();
  headers.set('content-type', 'application/json');

  const request: any = {
    method,
    url: url || `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/tools/python`,
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

describe('ADK Python Tools - Integration Tests', () => {
  beforeEach(async () => {
    await cleanupTestDir();
    await ensureAgentDir();
  });

  afterEach(async () => {
    await cleanupTestDir();
  });

  describe('GET /api/adk-agents/[name]/tools/python - List Tools', () => {
    it('returns empty array when no tools directory exists', async () => {
      // WHEN: List tools for agent without tools directory
      const request = createMockRequest('GET');
      const response = await listTools(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return empty tools array
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.agentName, TEST_PROJECT);
      assert.ok(Array.isArray(data.tools));
      assert.strictEqual(data.tools.length, 0);
    });

    it('returns empty array when tools directory is empty', async () => {
      // GIVEN: Empty tools directory
      await fs.mkdir(TEST_TOOLS_DIR, { recursive: true });

      // WHEN: List tools
      const request = createMockRequest('GET');
      const response = await listTools(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return empty tools array
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.tools.length, 0);
    });

    it('returns list of Python tools with metadata', async () => {
      // GIVEN: Tools directory with Python files
      await fs.mkdir(TEST_TOOLS_DIR, { recursive: true });

      const tool1Code = `def add_numbers(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b
`;

      const tool2Code = `def multiply(x: float, y: float = 1.0) -> float:
    """Multiply two numbers."""
    return x * y
`;

      await fs.writeFile(path.join(TEST_TOOLS_DIR, 'add_numbers.py'), tool1Code);
      await fs.writeFile(path.join(TEST_TOOLS_DIR, 'multiply.py'), tool2Code);

      // WHEN: List tools
      const request = createMockRequest('GET');
      const response = await listTools(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return both tools with signatures
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.tools.length, 2);

      const addTool = data.tools.find((t: any) => t.name === 'add_numbers');
      assert.ok(addTool, 'Should have add_numbers tool');
      assert.strictEqual(addTool.filename, 'add_numbers.py');
      assert.strictEqual(addTool.code, tool1Code);
      assert.strictEqual(addTool.enabled, true);
      assert.ok(addTool.signature, 'Should have signature');
      assert.strictEqual(addTool.signature.name, 'add_numbers');
      assert.strictEqual(addTool.signature.docstring, 'Add two numbers together.');
      assert.strictEqual(addTool.signature.params.length, 2);
    });

    it('returns 404 for non-existent agent', async () => {
      // WHEN: List tools for non-existent agent
      const request = createMockRequest('GET');
      const response = await listTools(request, { params: createParams({ name: 'non-existent-agent' }) });

      // THEN: Should return 404
      assert.strictEqual(response.status, 404);
      const data = await response.json();
      assert.ok(data.error);
    });
  });

  describe('POST /api/adk-agents/[name]/tools/python - Create Tool', () => {
    it('creates a new Python tool file', async () => {
      // WHEN: Create a new tool
      const toolCode = `def greet(name: str) -> str:
    """Greet someone by name."""
    return f"Hello, {name}!"
`;

      const request = createMockRequest('POST', undefined, {
        name: 'greet',
        code: toolCode,
      });
      const response = await createTool(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return success
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.tool.filename, 'greet.py');
      assert.strictEqual(data.tool.name, 'greet');
      assert.strictEqual(data.tool.code, toolCode);
      assert.ok(data.tool.signature);

      // AND: File should exist on disk
      const filePath = path.join(TEST_TOOLS_DIR, 'greet.py');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      assert.strictEqual(fileContent, toolCode);
    });

    it('sanitizes tool names to valid Python filenames', async () => {
      // WHEN: Create tool with special characters in name
      const request = createMockRequest('POST', undefined, {
        name: 'My Cool Tool!',
        code: 'def my_cool_tool():\n    pass\n',
      });
      const response = await createTool(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should sanitize to valid filename
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.tool.filename, 'my_cool_tool_.py');
      assert.strictEqual(data.tool.name, 'my_cool_tool_');
    });

    it('returns 409 if tool file already exists', async () => {
      // GIVEN: Existing tool file
      await fs.mkdir(TEST_TOOLS_DIR, { recursive: true });
      await fs.writeFile(path.join(TEST_TOOLS_DIR, 'existing.py'), 'def existing():\n    pass\n');

      // WHEN: Try to create tool with same name
      const request = createMockRequest('POST', undefined, {
        name: 'existing',
        code: 'def existing():\n    pass\n',
      });
      const response = await createTool(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 409 conflict
      assert.strictEqual(response.status, 409);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('already exists'));
    });

    it('validates request body - missing name', async () => {
      // WHEN: Create tool without name
      const request = createMockRequest('POST', undefined, {
        code: 'def foo():\n    pass\n',
      });
      const response = await createTool(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400 validation error
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.strictEqual(data.error, 'Validation failed');
    });

    it('validates request body - missing code', async () => {
      // WHEN: Create tool without code
      const request = createMockRequest('POST', undefined, {
        name: 'test_tool',
      });
      const response = await createTool(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400 validation error
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
    });

    it('extracts function signature with parameters', async () => {
      // WHEN: Create tool with typed parameters
      const toolCode = `def calculate(x: int, y: int, operator: str = "add") -> int:
    """Calculate result of operation."""
    if operator == "add":
        return x + y
    return x - y
`;

      const request = createMockRequest('POST', undefined, {
        name: 'calculate',
        code: toolCode,
      });
      const response = await createTool(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should extract signature correctly
      assert.strictEqual(response.status, 200);
      const sig = data.tool.signature;
      assert.strictEqual(sig.name, 'calculate');
      assert.strictEqual(sig.returnType, 'int');
      assert.strictEqual(sig.docstring, 'Calculate result of operation.');
      assert.strictEqual(sig.params.length, 3);

      // Check parameters
      const [paramX, paramY, paramOp] = sig.params;
      assert.strictEqual(paramX.name, 'x');
      assert.strictEqual(paramX.type, 'int');
      assert.strictEqual(paramX.required, true);

      assert.strictEqual(paramY.name, 'y');
      assert.strictEqual(paramY.type, 'int');
      assert.strictEqual(paramY.required, true);

      assert.strictEqual(paramOp.name, 'operator');
      assert.strictEqual(paramOp.type, 'str');
      assert.strictEqual(paramOp.required, false);
      assert.strictEqual(paramOp.default, '"add"');
    });
  });

  describe('PUT /api/adk-agents/[name]/tools/python - Update Tool', () => {
    it('updates an existing Python tool file', async () => {
      // GIVEN: Existing tool file
      await fs.mkdir(TEST_TOOLS_DIR, { recursive: true });
      const originalCode = 'def old_version():\n    pass\n';
      await fs.writeFile(path.join(TEST_TOOLS_DIR, 'my_tool.py'), originalCode);

      // WHEN: Update the tool
      const updatedCode = `def new_version(param: str) -> str:
    """Updated version."""
    return param.upper()
`;

      const request = createMockRequest('PUT', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/tools/python?filename=my_tool.py`, {
        code: updatedCode,
      });
      const response = await updateTool(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return success with updated signature
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.tool.code, updatedCode);
      assert.strictEqual(data.tool.signature.name, 'new_version');

      // AND: File should be updated on disk
      const fileContent = await fs.readFile(path.join(TEST_TOOLS_DIR, 'my_tool.py'), 'utf-8');
      assert.strictEqual(fileContent, updatedCode);
    });

    it('returns 404 if tool file does not exist', async () => {
      // WHEN: Try to update non-existent tool
      const request = createMockRequest('PUT', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/tools/python?filename=nonexistent.py`, {
        code: 'def foo():\n    pass\n',
      });
      const response = await updateTool(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 404
      assert.strictEqual(response.status, 404);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('not found'));
    });

    it('requires filename query parameter', async () => {
      // WHEN: Update without filename query param
      const request = createMockRequest('PUT', undefined, {
        code: 'def foo():\n    pass\n',
      });
      const response = await updateTool(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('filename'));
    });
  });

  describe('DELETE /api/adk-agents/[name]/tools/python - Delete Tool', () => {
    it('deletes an existing Python tool file', async () => {
      // GIVEN: Existing tool file
      await fs.mkdir(TEST_TOOLS_DIR, { recursive: true });
      const toolPath = path.join(TEST_TOOLS_DIR, 'delete_me.py');
      await fs.writeFile(toolPath, 'def delete_me():\n    pass\n');

      // WHEN: Delete the tool
      const request = createMockRequest('DELETE', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/tools/python?filename=delete_me.py`);
      const response = await deleteTool(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return success
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.filename, 'delete_me.py');

      // AND: File should be deleted from disk
      const fileExists = await fs.access(toolPath).then(() => true).catch(() => false);
      assert.strictEqual(fileExists, false);
    });

    it('returns 404 if tool file does not exist', async () => {
      // WHEN: Try to delete non-existent tool
      const request = createMockRequest('DELETE', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/tools/python?filename=nonexistent.py`);
      const response = await deleteTool(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 404
      assert.strictEqual(response.status, 404);
      const data = await response.json();
      assert.ok(data.error);
    });

    it('requires filename query parameter', async () => {
      // WHEN: Delete without filename query param
      const request = createMockRequest('DELETE');
      const response = await deleteTool(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('filename'));
    });

    it('prevents directory traversal attacks', async () => {
      // WHEN: Try to delete file outside tools directory
      const request = createMockRequest('DELETE', `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/tools/python?filename=../../secrets.py`);
      const response = await deleteTool(request, { params: createParams({ name: TEST_PROJECT }) });

      // THEN: Should return 400 invalid filename
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('Invalid filename'));
    });
  });
});
