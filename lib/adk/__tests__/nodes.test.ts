/**
 * Unit Tests for ADK Node Utilities (lib/adk/nodes.ts)
 *
 * These tests verify USER BEHAVIOR, not implementation details:
 * - When a user loads a project, they see correct nodes on the canvas
 * - When a user saves changes, the YAML is correctly structured
 * - Agent names and filenames convert properly
 *
 * VERIFICATION REQUIRED:
 * Before removing any E2E tests, run both this file and the E2E tests
 * side-by-side to confirm they test the same user behaviors.
 *
 * Related E2E tests:
 * - e2e/adk-visual-builder/phase1-basic-operations.spec.ts
 * - e2e/adk-visual-builder/phase9-tools-panel.spec.ts
 * - e2e/adk-visual-builder/phase9.4-openapi-tools.spec.ts
 * - e2e/adk-visual-builder/phase10-callbacks.spec.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  agentFilesToNodes,
  nodesToYaml,
  nameToFilename,
  filenameToName,
  getNodeType,
  type AgentFile,
} from '../nodes';

describe('ADK Nodes - User Behavior Tests', () => {
  /**
   * User Behavior: When a user names an agent "My Cool Agent",
   * the file is saved as "my_cool_agent.yaml"
   *
   * Related E2E: phase1 "the filename matches the agent name in snake_case"
   */
  describe('User names an agent', () => {
    it('converts agent name to snake_case filename', () => {
      // User names agent "My Cool Agent"
      const filename = nameToFilename('My Cool Agent');

      // User sees file "my_cool_agent.yaml"
      assert.strictEqual(filename, 'my_cool_agent.yaml');
    });

    it('handles simple names', () => {
      assert.strictEqual(nameToFilename('agent'), 'agent.yaml');
      assert.strictEqual(nameToFilename('MyAgent'), 'myagent.yaml');
    });

    it('handles multiple spaces', () => {
      assert.strictEqual(nameToFilename('My   Cool   Agent'), 'my_cool_agent.yaml');
    });

    it('converts filename back to display name', () => {
      // File "my_cool_agent.yaml" shows as "my cool agent" in UI
      assert.strictEqual(filenameToName('my_cool_agent.yaml'), 'my cool agent');
      assert.strictEqual(filenameToName('root_agent.yaml'), 'root agent');
    });
  });

  /**
   * User Behavior: When a user drags different agent types,
   * they appear as different node types on the canvas
   *
   * Related E2E: phase1 "SequentialAgent does NOT show model dropdown"
   * (The UI shows different panels based on node type)
   */
  describe('User drags different agent types', () => {
    it('LlmAgent appears as an agent node', () => {
      assert.strictEqual(getNodeType('LlmAgent'), 'agent');
    });

    it('SequentialAgent appears as a container node', () => {
      assert.strictEqual(getNodeType('SequentialAgent'), 'container');
    });

    it('ParallelAgent appears as a container node', () => {
      assert.strictEqual(getNodeType('ParallelAgent'), 'container');
    });

    it('LoopAgent appears as a container node', () => {
      assert.strictEqual(getNodeType('LoopAgent'), 'container');
    });

    it('unknown agent types default to agent node', () => {
      assert.strictEqual(getNodeType('CustomAgent'), 'agent');
    });
  });

  /**
   * User Behavior: When a user loads a project with YAML files,
   * they see the agents rendered as nodes on the canvas
   *
   * Related E2E: phase1 "dropping an LlmAgent creates a YAML file"
   */
  describe('User loads a project with agents', () => {
    it('parses a single LlmAgent YAML into a node', () => {
      const files: AgentFile[] = [
        {
          filename: 'root_agent.yaml',
          yaml: `
name: root_agent
agent_class: LlmAgent
model: gemini-2.0-flash
description: A helpful assistant
instruction: Be helpful and concise
`,
        },
      ];

      const { nodes, edges } = agentFilesToNodes(files);

      // User sees one node on canvas
      assert.strictEqual(nodes.length, 1);

      // Node has correct data
      const rootNode = nodes[0];
      assert.strictEqual(rootNode.data.name, 'root_agent');
      assert.strictEqual(rootNode.data.agentClass, 'LlmAgent');
      assert.strictEqual(rootNode.data.model, 'gemini-2.0-flash');
      assert.strictEqual(rootNode.data.description, 'A helpful assistant');
      assert.strictEqual(rootNode.data.instruction, 'Be helpful and concise');
      assert.strictEqual(rootNode.data.isRoot, true);
      assert.strictEqual(rootNode.type, 'agent');
    });

    it('parses a SequentialAgent with sub_agents', () => {
      const files: AgentFile[] = [
        {
          filename: 'root_agent.yaml',
          yaml: `
name: orchestrator
agent_class: SequentialAgent
sub_agents:
  - config_path: step1.yaml
  - config_path: step2.yaml
`,
        },
        {
          filename: 'step1.yaml',
          yaml: `
name: step1
agent_class: LlmAgent
model: gemini-2.0-flash
`,
        },
        {
          filename: 'step2.yaml',
          yaml: `
name: step2
agent_class: LlmAgent
model: gemini-2.0-flash
`,
        },
      ];

      const { nodes, edges } = agentFilesToNodes(files);

      // User sees 3 nodes
      assert.strictEqual(nodes.length, 3);

      // Root is a container
      const rootNode = nodes.find((n) => n.data.isRoot);
      assert.ok(rootNode);
      assert.strictEqual(rootNode.type, 'container');
      assert.strictEqual(rootNode.data.agentClass, 'SequentialAgent');

      // Has child agents data for the container visualization
      assert.ok(rootNode.data.childAgents);
      assert.strictEqual(rootNode.data.childAgents.length, 2);

      // Edges connect the nodes in sequence
      assert.ok(edges.length > 0);
    });

    it('parses tools from YAML', () => {
      const files: AgentFile[] = [
        {
          filename: 'root_agent.yaml',
          yaml: `
name: tool_agent
agent_class: LlmAgent
model: gemini-2.0-flash
tools:
  - google_search
  - code_execution
`,
        },
      ];

      const { nodes } = agentFilesToNodes(files);
      const rootNode = nodes[0];

      // User sees tools listed in the properties panel
      assert.ok(rootNode.data.tools);
      assert.strictEqual(rootNode.data.tools.length, 2);
      assert.ok(rootNode.data.tools.includes('google_search'));
      assert.ok(rootNode.data.tools.includes('code_execution'));
    });

    it('parses MCP servers from tools', () => {
      const files: AgentFile[] = [
        {
          filename: 'root_agent.yaml',
          yaml: `
name: mcp_agent
agent_class: LlmAgent
model: gemini-2.0-flash
tools:
  - name: MCPToolset
    args:
      stdio_server_params:
        command: npx
        args:
          - -y
          - "@anthropic/mcp-server"
`,
        },
      ];

      const { nodes } = agentFilesToNodes(files);
      const rootNode = nodes[0];

      // User sees MCP server in the MCP panel
      assert.ok(rootNode.data.mcpServers);
      assert.strictEqual(rootNode.data.mcpServers.length, 1);
      assert.strictEqual(rootNode.data.mcpServers[0].type, 'stdio');
      assert.strictEqual(rootNode.data.mcpServers[0].command, 'npx');
    });

    it('parses SSE MCP servers', () => {
      const files: AgentFile[] = [
        {
          filename: 'root_agent.yaml',
          yaml: `
name: sse_agent
agent_class: LlmAgent
model: gemini-2.0-flash
tools:
  - name: MCPToolset
    args:
      sse_server_params:
        url: http://localhost:8080/sse
        headers:
          Authorization: Bearer token123
`,
        },
      ];

      const { nodes } = agentFilesToNodes(files);
      const rootNode = nodes[0];

      assert.ok(rootNode.data.mcpServers);
      assert.strictEqual(rootNode.data.mcpServers.length, 1);
      assert.strictEqual(rootNode.data.mcpServers[0].type, 'sse');
      assert.strictEqual(rootNode.data.mcpServers[0].url, 'http://localhost:8080/sse');
    });

    it('parses AgentTool entries', () => {
      const files: AgentFile[] = [
        {
          filename: 'root_agent.yaml',
          yaml: `
name: agent_tool_user
agent_class: LlmAgent
model: gemini-2.0-flash
tools:
  - name: AgentTool
    args:
      agent:
        config_path: helper_agent.yaml
`,
        },
      ];

      const { nodes } = agentFilesToNodes(files);
      const rootNode = nodes[0];

      // User sees agent tool in the tools panel
      assert.ok(rootNode.data.agentTools);
      assert.strictEqual(rootNode.data.agentTools.length, 1);
      assert.strictEqual(rootNode.data.agentTools[0].agentPath, 'helper_agent.yaml');
      assert.strictEqual(rootNode.data.agentTools[0].agentName, 'helper_agent');
    });

    it('parses OpenAPI toolset entries', () => {
      const files: AgentFile[] = [
        {
          filename: 'root_agent.yaml',
          yaml: `
name: api_agent
agent_class: LlmAgent
model: gemini-2.0-flash
tools:
  - name: OpenAPIToolset
    args:
      name: PetStore API
      spec_url: https://petstore.swagger.io/v2/swagger.json
`,
        },
      ];

      const { nodes } = agentFilesToNodes(files);
      const rootNode = nodes[0];

      // User sees OpenAPI tool in the tools panel
      assert.ok(rootNode.data.openApiTools);
      assert.strictEqual(rootNode.data.openApiTools.length, 1);
      assert.strictEqual(rootNode.data.openApiTools[0].name, 'PetStore API');
      assert.strictEqual(
        rootNode.data.openApiTools[0].specUrl,
        'https://petstore.swagger.io/v2/swagger.json'
      );
    });

    it('parses tool confirmation configs', () => {
      const files: AgentFile[] = [
        {
          filename: 'root_agent.yaml',
          yaml: `
name: confirm_agent
agent_class: LlmAgent
model: gemini-2.0-flash
tools:
  - name: dangerous_tool
    require_confirmation: true
    confirmation_prompt: Are you sure you want to run this?
`,
        },
      ];

      const { nodes } = agentFilesToNodes(files);
      const rootNode = nodes[0];

      // User sees tool with confirmation in the tools panel
      assert.ok(rootNode.data.tools);
      assert.ok(rootNode.data.tools.includes('dangerous_tool'));
      assert.ok(rootNode.data.toolConfigs);
      const config = rootNode.data.toolConfigs.get('dangerous_tool');
      assert.ok(config);
      assert.strictEqual(config.requireConfirmation, true);
      assert.strictEqual(config.confirmationPrompt, 'Are you sure you want to run this?');
    });

    it('parses callbacks from YAML', () => {
      const files: AgentFile[] = [
        {
          filename: 'root_agent.yaml',
          yaml: `
name: callback_agent
agent_class: LlmAgent
model: gemini-2.0-flash
before_agent_callbacks:
  - name: callbacks.log_start
after_agent_callbacks:
  - name: callbacks.log_end
before_model_callbacks:
  - name: callbacks.validate_input
`,
        },
      ];

      const { nodes } = agentFilesToNodes(files);
      const rootNode = nodes[0];

      // User sees callbacks in the callbacks panel
      assert.ok(rootNode.data.callbacks);
      assert.strictEqual(rootNode.data.callbacks.length, 3);

      const beforeAgent = rootNode.data.callbacks.find((c: { type: string }) => c.type === 'before_agent');
      assert.ok(beforeAgent);
      assert.strictEqual(beforeAgent.functionPath, 'callbacks.log_start');

      const afterAgent = rootNode.data.callbacks.find((c: { type: string }) => c.type === 'after_agent');
      assert.ok(afterAgent);

      const beforeModel = rootNode.data.callbacks.find((c: { type: string }) => c.type === 'before_model');
      assert.ok(beforeModel);
    });

    it('parses generation_config', () => {
      const files: AgentFile[] = [
        {
          filename: 'root_agent.yaml',
          yaml: `
name: gen_config_agent
agent_class: LlmAgent
model: gemini-2.0-flash
generation_config:
  temperature: 0.7
  max_output_tokens: 2048
  top_p: 0.9
  top_k: 40
`,
        },
      ];

      const { nodes } = agentFilesToNodes(files);
      const rootNode = nodes[0];

      // User sees generation config in the model settings
      assert.ok(rootNode.data.generation_config);
      assert.strictEqual(rootNode.data.generation_config.temperature, 0.7);
      assert.strictEqual(rootNode.data.generation_config.max_output_tokens, 2048);
      assert.strictEqual(rootNode.data.generation_config.top_p, 0.9);
      assert.strictEqual(rootNode.data.generation_config.top_k, 40);
    });
  });

  /**
   * User Behavior: When a user makes changes and saves,
   * the YAML file is correctly structured
   *
   * Related E2E: phase1 "the created file contains correct YAML structure"
   */
  describe('User saves changes to an agent', () => {
    it('generates correct YAML for LlmAgent with model', () => {
      const nodes = [
        {
          id: 'root',
          type: 'agent',
          position: { x: 0, y: 0 },
          data: {
            name: 'My Agent',
            agentClass: 'LlmAgent',
            model: 'gemini-2.0-flash',
            description: 'A helpful agent',
            instruction: 'Be helpful',
            isRoot: true,
            filename: 'my_agent.yaml',
            tools: [],
          },
        },
      ];

      const yaml = nodesToYaml(nodes, []);

      // YAML should have correct structure
      assert.ok(yaml.includes('name: my_agent'));
      assert.ok(yaml.includes('agent_class: LlmAgent'));
      assert.ok(yaml.includes('model: gemini-2.0-flash'));
      assert.ok(yaml.includes('description: A helpful agent'));
      assert.ok(yaml.includes('instruction: Be helpful'));
    });

    it('generates YAML with tools', () => {
      const nodes = [
        {
          id: 'root',
          type: 'agent',
          position: { x: 0, y: 0 },
          data: {
            name: 'Tool Agent',
            agentClass: 'LlmAgent',
            model: 'gemini-2.0-flash',
            isRoot: true,
            filename: 'tool_agent.yaml',
            tools: ['google_search', 'code_execution'],
          },
        },
      ];

      const yaml = nodesToYaml(nodes, []);

      assert.ok(yaml.includes('tools:'));
      assert.ok(yaml.includes('google_search'));
      assert.ok(yaml.includes('code_execution'));
    });

    it('generates YAML with tools in ADK-compliant object format (not strings)', () => {
      // User adds built-in tools via the visual builder
      const nodes = [
        {
          id: 'root',
          type: 'agent',
          position: { x: 0, y: 0 },
          data: {
            name: 'Tool Agent',
            agentClass: 'LlmAgent',
            model: 'gemini-2.0-flash',
            isRoot: true,
            filename: 'tool_agent.yaml',
            tools: ['google_search', 'built_in_code_execution'],
          },
        },
      ];

      const yaml = nodesToYaml(nodes, []);

      // CRITICAL: Tools MUST be in object format with 'name' field
      // Correct format:   - name: google_search
      // Incorrect format: - google_search
      assert.ok(yaml.includes('  - name: google_search'), 'google_search should use object format with name field');
      assert.ok(yaml.includes('  - name: built_in_code_execution'), 'built_in_code_execution should use object format with name field');

      // Verify the WRONG format is NOT present
      assert.ok(!yaml.match(/^\s*-\s+google_search\s*$/m), 'google_search should NOT be a plain string');
      assert.ok(!yaml.match(/^\s*-\s+built_in_code_execution\s*$/m), 'built_in_code_execution should NOT be a plain string');
    });

    it('generates YAML with MCP servers', () => {
      const nodes = [
        {
          id: 'root',
          type: 'agent',
          position: { x: 0, y: 0 },
          data: {
            name: 'MCP Agent',
            agentClass: 'LlmAgent',
            model: 'gemini-2.0-flash',
            isRoot: true,
            filename: 'mcp_agent.yaml',
            tools: [],
            mcpServers: [
              {
                id: 'mcp-1',
                name: 'Test Server',
                type: 'stdio' as const,
                command: 'npx',
                args: ['-y', '@test/server'],
              },
            ],
          },
        },
      ];

      const yaml = nodesToYaml(nodes, []);

      assert.ok(yaml.includes('name: MCPToolset'));
      assert.ok(yaml.includes('stdio_server_params:'));
      assert.ok(yaml.includes('command: npx'));
    });

    it('generates YAML with tool confirmation config', () => {
      const toolConfigs = new Map();
      toolConfigs.set('dangerous_tool', {
        id: 'dangerous_tool',
        requireConfirmation: true,
        confirmationPrompt: 'Are you sure?',
      });

      const nodes = [
        {
          id: 'root',
          type: 'agent',
          position: { x: 0, y: 0 },
          data: {
            name: 'Confirm Agent',
            agentClass: 'LlmAgent',
            model: 'gemini-2.0-flash',
            isRoot: true,
            filename: 'confirm_agent.yaml',
            tools: ['dangerous_tool'],
            toolConfigs,
          },
        },
      ];

      const yaml = nodesToYaml(nodes, []);

      assert.ok(yaml.includes('name: dangerous_tool'));
      assert.ok(yaml.includes('require_confirmation: true'));
      assert.ok(yaml.includes('confirmation_prompt: Are you sure?'));
    });

    it('generates YAML with callbacks', () => {
      const nodes = [
        {
          id: 'root',
          type: 'agent',
          position: { x: 0, y: 0 },
          data: {
            name: 'Callback Agent',
            agentClass: 'LlmAgent',
            model: 'gemini-2.0-flash',
            isRoot: true,
            filename: 'callback_agent.yaml',
            tools: [],
            callbacks: [
              { id: '1', type: 'before_agent', functionPath: 'callbacks.start' },
              { id: '2', type: 'after_agent', functionPath: 'callbacks.end' },
            ],
          },
        },
      ];

      const yaml = nodesToYaml(nodes, []);

      assert.ok(yaml.includes('before_agent_callbacks:'));
      assert.ok(yaml.includes('name: callbacks.start'));
      assert.ok(yaml.includes('after_agent_callbacks:'));
      assert.ok(yaml.includes('name: callbacks.end'));
    });

    it('generates YAML with generation_config', () => {
      const nodes = [
        {
          id: 'root',
          type: 'agent',
          position: { x: 0, y: 0 },
          data: {
            name: 'Gen Config Agent',
            agentClass: 'LlmAgent',
            model: 'gemini-2.0-flash',
            isRoot: true,
            filename: 'gen_config_agent.yaml',
            tools: [],
            generation_config: {
              temperature: 0.5,
              max_output_tokens: 1000,
            },
          },
        },
      ];

      const yaml = nodesToYaml(nodes, []);

      assert.ok(yaml.includes('generation_config:'));
      assert.ok(yaml.includes('temperature: 0.5'));
      assert.ok(yaml.includes('max_output_tokens: 1000'));
    });

    it('generates YAML with sub_agents for container nodes', () => {
      const nodes = [
        {
          id: 'root',
          type: 'container',
          position: { x: 0, y: 0 },
          data: {
            name: 'Orchestrator',
            agentClass: 'SequentialAgent',
            isRoot: true,
            filename: 'orchestrator.yaml',
            tools: [],
          },
        },
        {
          id: 'agent-1',
          type: 'agent',
          position: { x: 0, y: 100 },
          data: {
            name: 'Step 1',
            agentClass: 'LlmAgent',
            model: 'gemini-2.0-flash',
            isRoot: false,
            filename: 'step_1.yaml',
            tools: [],
          },
        },
      ];

      const edges = [
        { id: 'e1', source: 'root', target: 'agent-1' },
      ];

      const yaml = nodesToYaml(nodes, edges);

      assert.ok(yaml.includes('agent_class: SequentialAgent'));
      assert.ok(yaml.includes('sub_agents:'));
      assert.ok(yaml.includes('config_path: ./step_1.yaml'));
    });

    it('SequentialAgent YAML does NOT include model field', () => {
      const nodes = [
        {
          id: 'root',
          type: 'container',
          position: { x: 0, y: 0 },
          data: {
            name: 'Orchestrator',
            agentClass: 'SequentialAgent',
            isRoot: true,
            filename: 'orchestrator.yaml',
            tools: [],
          },
        },
      ];

      const yaml = nodesToYaml(nodes, []);

      assert.ok(yaml.includes('agent_class: SequentialAgent'));
      assert.ok(!yaml.includes('model:'), 'SequentialAgent should not have model field');
    });
  });

  /**
   * Edge cases that could affect user experience
   */
  describe('Edge cases', () => {
    it('handles empty files array', () => {
      const { nodes, edges } = agentFilesToNodes([]);
      assert.strictEqual(nodes.length, 0);
      assert.strictEqual(edges.length, 0);
    });

    it('handles invalid YAML gracefully', () => {
      const files: AgentFile[] = [
        {
          filename: 'invalid.yaml',
          yaml: 'not: valid: yaml: {{{{',
        },
      ];

      // Should not throw, just skip invalid files
      const { nodes } = agentFilesToNodes(files);
      assert.strictEqual(nodes.length, 0);
    });

    it('handles YAML without name field', () => {
      const files: AgentFile[] = [
        {
          filename: 'no_name.yaml',
          yaml: `
agent_class: LlmAgent
model: gemini-2.0-flash
`,
        },
      ];

      const { nodes } = agentFilesToNodes(files);
      // Without a name, it shouldn't be added
      assert.strictEqual(nodes.length, 0);
    });

    it('returns empty string for nodesToYaml with no root node', () => {
      const nodes = [
        {
          id: 'agent-1',
          type: 'agent',
          position: { x: 0, y: 0 },
          data: {
            name: 'Not Root',
            agentClass: 'LlmAgent',
            isRoot: false,
            tools: [],
          },
        },
      ];

      const yaml = nodesToYaml(nodes, []);
      assert.strictEqual(yaml, '');
    });

    it('handles mixed tool types in a single agent', () => {
      const files: AgentFile[] = [
        {
          filename: 'root_agent.yaml',
          yaml: `
name: mixed_tools_agent
agent_class: LlmAgent
model: gemini-2.0-flash
tools:
  - google_search
  - name: MCPToolset
    args:
      stdio_server_params:
        command: mcp-server
  - name: AgentTool
    args:
      agent:
        config_path: helper.yaml
  - name: OpenAPIToolset
    args:
      name: My API
      spec_url: https://api.example.com/openapi.json
`,
        },
      ];

      const { nodes } = agentFilesToNodes(files);
      const rootNode = nodes[0];

      // All tool types should be parsed
      assert.ok(rootNode.data.tools.includes('google_search'));
      assert.strictEqual(rootNode.data.mcpServers.length, 1);
      assert.strictEqual(rootNode.data.agentTools.length, 1);
      assert.strictEqual(rootNode.data.openApiTools.length, 1);
    });
  });

  /**
   * Integration-like tests that verify round-trip behavior
   */
  describe('Round-trip: YAML -> Nodes -> YAML', () => {
    it('preserves agent data through round-trip', () => {
      const originalYaml = `name: test_agent
agent_class: LlmAgent
model: gemini-2.0-flash
description: Test description
instruction: Test instruction
tools:
  - google_search
`;

      const files: AgentFile[] = [{ filename: 'test_agent.yaml', yaml: originalYaml }];
      const { nodes, edges } = agentFilesToNodes(files);

      const regeneratedYaml = nodesToYaml(nodes, edges);

      // Key fields should be preserved
      assert.ok(regeneratedYaml.includes('name: test_agent'));
      assert.ok(regeneratedYaml.includes('agent_class: LlmAgent'));
      assert.ok(regeneratedYaml.includes('model: gemini-2.0-flash'));
      assert.ok(regeneratedYaml.includes('description: Test description'));
      assert.ok(regeneratedYaml.includes('instruction: Test instruction'));
      assert.ok(regeneratedYaml.includes('google_search'));
    });
  });
});
