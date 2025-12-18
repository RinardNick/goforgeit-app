import { describe, it, mock, before, after } from 'node:test';
import assert from 'node:assert';

// Mock dependencies
const mockFs = {
  readdir: mock.fn(async () => ['agent1.yaml', 'agent2.yaml']),
  readFile: mock.fn(async () => 'name: agent1\nagent_class: LlmAgent\n'),
  writeFile: mock.fn(async () => undefined),
  access: mock.fn(async () => undefined),
  mkdir: mock.fn(async () => undefined),
};

const mockFetch = mock.fn(async () => ({
  ok: true,
  text: async () => 'mock response',
  json: async () => ({}),
}));

// Mock process.env
const originalEnv = process.env;

import { createAgentTool, listAgentsTool, addSubAgentTool, createPythonToolTool } from '../builder-tools'; 

describe('Builder Tools', () => {
  
  before(() => {
    process.env = { ...originalEnv, ADK_AGENTS_BASE_PATH: '/tmp/agents' };
    global.fetch = mockFetch as any;
  });

  after(() => {
    process.env = originalEnv;
  });

  describe('listAgentsTool', () => {
    it('should list agents from filesystem in dev mode', async () => {
      // Setup Dev Mode
      process.env.NODE_ENV = 'development';
      
      const tool = listAgentsTool({ fs: mockFs as any });
      // Genkit tools are callable functions
      const result = await tool({ projectName: 'test_project' });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.agents.length, 2);
      assert.strictEqual(mockFs.readdir.mock.callCount(), 1);
    });
  });

  describe('createAgentTool', () => {
    it('should create an agent file', async () => {
      process.env.NODE_ENV = 'development';
      
      // Mock that new_agent.yaml does NOT exist (so we can create it)
      mockFs.access.mock.mockImplementation(async (p) => {
        if (typeof p === 'string' && p.endsWith('new_agent.yaml')) {
          throw new Error('File not found');
        }
        return undefined; // Exists (project dir, etc.)
      });

      const tool = createAgentTool({ fs: mockFs as any });
      
      const result = await tool({
        projectName: 'test_project',
        name: 'new_agent',
        agentClass: 'LlmAgent',
        model: 'gemini-2.0-flash-exp'
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(mockFs.writeFile.mock.callCount(), 1);
      
      const args = mockFs.writeFile.mock.calls[0].arguments;
      assert.match(args[0], /new_agent.yaml$/);
      assert.match(args[1], /name: new_agent/);
    });
  });

  describe('addSubAgentTool', () => {
    it('should add sub-agent to parent', async () => {
      process.env.NODE_ENV = 'development';
      // Mock parent reading
      mockFs.readFile.mock.mockImplementationOnce(async () => 'name: parent\nagent_class: SequentialAgent\n');
      
      const tool = addSubAgentTool({ fs: mockFs as any });
      const result = await tool({
        projectName: 'test_project',
        parentFilename: 'parent.yaml',
        childFilename: 'child.yaml'
      });
      
      assert.strictEqual(result.success, true);
      // writeFile count depends on test execution order (previous tests ran).
      // Let's check the LAST call.
      const calls = mockFs.writeFile.mock.calls;
      const lastCall = calls[calls.length - 1];
      
      const args = lastCall.arguments;
      assert.match(args[1], /sub_agents:/);
      assert.match(args[1], /config_path: child.yaml/);
    });
  });

  describe('createPythonToolTool', () => {
    it('should create python tool file', async () => {
      process.env.NODE_ENV = 'development';
      const tool = createPythonToolTool({ fs: mockFs as any });
      const result = await tool({
        projectName: 'test_project',
        name: 'my_tool',
        code: 'def my_tool(): pass'
      });
      
      assert.strictEqual(result.success, true);
      const calls = mockFs.writeFile.mock.calls;
      const pyCall = calls.find(c => typeof c.arguments[0] === 'string' && c.arguments[0].endsWith('my_tool.py'));
      assert.ok(pyCall);
      assert.strictEqual(pyCall.arguments[1], 'def my_tool(): pass');
    });
  });
});