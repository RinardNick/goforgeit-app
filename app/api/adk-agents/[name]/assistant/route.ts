import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType, FunctionCallingMode, Content, FunctionDeclaration } from '@google/generative-ai';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const runtime = 'nodejs';

// Request schema for the AI assistant
const AssistantRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  context: z.object({
    agents: z.array(z.object({
      filename: z.string(),
      name: z.string(),
      agentClass: z.string(),
    })),
    selectedAgent: z.object({
      filename: z.string(),
      name: z.string(),
    }).nullable(),
  }),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

// Tool execution result
interface ToolResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// Action that was executed
interface ExecutedAction {
  tool: string;
  args: Record<string, unknown>;
  result: ToolResult;
}

// Available built-in tools in ADK
const BUILTIN_TOOLS = [
  'google_search',
  'built_in_code_execution',
  'load_web_page',
  'load_artifacts',
];

// Popular MCP servers that can be configured
const MCP_SERVERS = [
  { name: 'filesystem', description: 'Read/write files on the local filesystem' },
  { name: 'postgres', description: 'Query PostgreSQL databases' },
  { name: 'sqlite', description: 'Query SQLite databases' },
  { name: 'github', description: 'Interact with GitHub repositories' },
  { name: 'slack', description: 'Send messages to Slack' },
  { name: 'google-drive', description: 'Access Google Drive files' },
];

// Agent class descriptions
const AGENT_CLASSES = {
  LlmAgent: 'A general-purpose LLM agent that can use tools and generate responses. Best for conversational tasks and tool use.',
  SequentialAgent: 'An agent that executes sub-agents in sequence, one after another. Good for multi-step workflows.',
  ParallelAgent: 'An agent that executes sub-agents in parallel. Good for independent tasks that can run simultaneously.',
  LoopAgent: 'An agent that repeatedly executes sub-agents until a condition is met.',
};

// Get ADK agents base path
const ADK_AGENTS_BASE_PATH = path.join(process.cwd(), 'adk-service', 'agents');

/**
 * Read all YAML files from the project directory
 */
async function readProjectAgentYamls(projectName: string): Promise<Map<string, string>> {
  const agentYamls = new Map<string, string>();
  const projectPath = path.join(ADK_AGENTS_BASE_PATH, projectName);

  try {
    const files = await fs.readdir(projectPath);
    const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

    for (const file of yamlFiles) {
      try {
        const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
        agentYamls.set(file, content);
      } catch {
        // Skip files that can't be read
      }
    }
  } catch {
    // Project directory doesn't exist or can't be read
  }

  return agentYamls;
}

/**
 * Read Python tools from the project's tools directory
 */
async function readProjectPythonTools(projectName: string): Promise<Map<string, string>> {
  const pythonTools = new Map<string, string>();
  const toolsPath = path.join(ADK_AGENTS_BASE_PATH, projectName, 'tools');

  try {
    const files = await fs.readdir(toolsPath);
    const pythonFiles = files.filter(f => f.endsWith('.py') && f !== '__init__.py');

    for (const file of pythonFiles) {
      try {
        const content = await fs.readFile(path.join(toolsPath, file), 'utf-8');
        pythonTools.set(file, content);
      } catch {
        // Skip files that can't be read
      }
    }
  } catch {
    // Tools directory doesn't exist or can't be read
  }

  return pythonTools;
}

// Tool definitions for Gemini function calling
const toolDefinitions: FunctionDeclaration[] = [
  {
    name: 'create_agent',
    description: 'Create a new agent YAML file in the project. Use this to create LlmAgent, SequentialAgent, ParallelAgent, or LoopAgent.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: {
          type: SchemaType.STRING,
          description: 'The agent name in snake_case (e.g., "my_agent")',
        },
        agentClass: {
          type: SchemaType.STRING,
          description: 'Agent type: LlmAgent, SequentialAgent, ParallelAgent, or LoopAgent',
        },
        model: {
          type: SchemaType.STRING,
          description: 'Model to use (for LlmAgent only). Default: gemini-2.0-flash-exp',
        },
        description: {
          type: SchemaType.STRING,
          description: 'Brief description of what the agent does',
        },
        instruction: {
          type: SchemaType.STRING,
          description: 'System instruction/prompt for the agent (for LlmAgent)',
        },
        tools: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'List of built-in tool names to add (for LlmAgent)',
        },
      },
      required: ['name', 'agentClass'],
    },
  },
  {
    name: 'add_sub_agent',
    description: 'Add an existing agent as a sub-agent to a parent container agent (SequentialAgent, ParallelAgent, LoopAgent) or LlmAgent. This creates the parent-child relationship.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        parentFilename: {
          type: SchemaType.STRING,
          description: 'The filename of the parent agent (e.g., "sequential_agent.yaml")',
        },
        childFilename: {
          type: SchemaType.STRING,
          description: 'The filename of the child agent to add (e.g., "helper_agent.yaml")',
        },
      },
      required: ['parentFilename', 'childFilename'],
    },
  },
  {
    name: 'add_tool',
    description: 'Add a built-in tool to an LlmAgent',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        agentFilename: {
          type: SchemaType.STRING,
          description: 'The filename of the agent (e.g., "my_agent.yaml")',
        },
        tool: {
          type: SchemaType.STRING,
          description: 'The built-in tool name (google_search, built_in_code_execution, load_web_page, load_artifacts)',
        },
      },
      required: ['agentFilename', 'tool'],
    },
  },
  {
    name: 'modify_agent',
    description: 'Modify an existing agent\'s properties (instruction, description, model, etc.)',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        agentFilename: {
          type: SchemaType.STRING,
          description: 'The filename of the agent to modify',
        },
        instruction: {
          type: SchemaType.STRING,
          description: 'New instruction/system prompt',
        },
        description: {
          type: SchemaType.STRING,
          description: 'New description',
        },
        model: {
          type: SchemaType.STRING,
          description: 'New model (for LlmAgent)',
        },
      },
      required: ['agentFilename'],
    },
  },
  {
    name: 'create_python_tool',
    description: 'Create a custom Python function tool file',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: {
          type: SchemaType.STRING,
          description: 'Tool name in snake_case',
        },
        code: {
          type: SchemaType.STRING,
          description: 'Complete Python function code with type hints and docstring',
        },
        addToAgent: {
          type: SchemaType.STRING,
          description: 'Optional: filename of agent to add this tool to',
        },
      },
      required: ['name', 'code'],
    },
  },
  {
    name: 'test_python_tool',
    description: 'Test a Python tool by executing it with sample arguments. Useful for verifying the tool works before adding it to an agent.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        toolName: {
          type: SchemaType.STRING,
          description: 'The name of the tool file (without .py) to test',
        },
        testCode: {
          type: SchemaType.STRING,
          description: 'Python code that imports the tool and calls the function with sample arguments. Example: `from tools.my_tool import my_function; print(my_function("test"))`',
        },
      },
      required: ['toolName', 'testCode'],
    },
  },
  {
    name: 'list_agents',
    description: 'List all agents in the current project with their configurations. Use this to understand the current state before making changes.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: 'read_agent',
    description: 'Read the full YAML configuration of a specific agent',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        filename: {
          type: SchemaType.STRING,
          description: 'The filename of the agent to read',
        },
      },
      required: ['filename'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the content of any file in the project (e.g., to debug a tool)',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        path: {
          type: SchemaType.STRING,
          description: 'Relative path to the file (e.g., "tools/my_tool.py")',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'delete_agent',
    description: 'Delete an agent YAML file from the project. Use with caution - this permanently removes the agent.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        filename: {
          type: SchemaType.STRING,
          description: 'The filename of the agent to delete (e.g., "my_agent.yaml")',
        },
      },
      required: ['filename'],
    },
  },
  {
    name: 'remove_tool',
    description: 'Remove a tool from an LlmAgent\'s tools list',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        agentFilename: {
          type: SchemaType.STRING,
          description: 'The filename of the agent (e.g., "my_agent.yaml")',
        },
        tool: {
          type: SchemaType.STRING,
          description: 'The tool name to remove (e.g., "google_search" or "tools/custom_tool.py")',
        },
      },
      required: ['agentFilename', 'tool'],
    },
  },
  {
    name: 'remove_sub_agent',
    description: 'Remove a sub-agent from a parent container agent. This removes the parent-child relationship but does not delete the child agent file.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        parentFilename: {
          type: SchemaType.STRING,
          description: 'The filename of the parent agent (e.g., "sequential_agent.yaml")',
        },
        childFilename: {
          type: SchemaType.STRING,
          description: 'The filename of the child agent to remove (e.g., "helper_agent.yaml")',
        },
      },
      required: ['parentFilename', 'childFilename'],
    },
  },
  {
    name: 'task_complete',
    description: 'Signal that all requested changes have been completed. Call this when you have finished all the work the user requested.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        summary: {
          type: SchemaType.STRING,
          description: 'A brief summary of all changes made',
        },
      },
      required: ['summary'],
    },
  },
];

/**
 * Execute a tool and return the result
 */
async function executeTool(
  projectName: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const projectPath = path.join(ADK_AGENTS_BASE_PATH, projectName);

  try {
    switch (toolName) {
      case 'create_agent': {
        const name = args.name as string;
        const agentClass = args.agentClass as string;
        const model = args.model as string || 'gemini-2.0-flash-exp';
        const description = args.description as string || '';
        const instruction = args.instruction as string || '';
        const tools = args.tools as string[] || [];

        // Generate filename
        const filename = `${name}.yaml`;
        const filePath = path.join(projectPath, filename);

        // Check if file already exists
        try {
          await fs.access(filePath);
          return {
            success: false,
            message: `Agent file ${filename} already exists`,
          };
        } catch {
          // File doesn't exist, good to proceed
        }

        // Build YAML content
        const agentConfig: Record<string, unknown> = {
          name,
          agent_class: agentClass,
        };

        if (agentClass === 'LlmAgent') {
          agentConfig.model = model;
          if (description) agentConfig.description = description;
          if (instruction) agentConfig.instruction = instruction;
          if (tools.length > 0) agentConfig.tools = tools;
        } else {
          // Container agents
          if (description) agentConfig.description = description;
          agentConfig.sub_agents = [];
        }

        const yamlContent = yaml.dump(agentConfig, { lineWidth: -1 });
        await fs.writeFile(filePath, yamlContent, 'utf-8');

        return {
          success: true,
          message: `Created agent ${name} in ${filename}`,
          data: { filename, agentClass },
        };
      }

      case 'add_sub_agent': {
        const parentFilename = args.parentFilename as string;
        const childFilename = args.childFilename as string;

        const parentPath = path.join(projectPath, parentFilename);
        const childPath = path.join(projectPath, childFilename);

        // Verify parent exists
        try {
          await fs.access(parentPath);
        } catch {
          return {
            success: false,
            message: `Parent agent file ${parentFilename} does not exist`,
          };
        }

        // Verify child exists
        try {
          await fs.access(childPath);
        } catch {
          return {
            success: false,
            message: `Child agent file ${childFilename} does not exist`,
          };
        }

        // Read parent YAML
        const parentContent = await fs.readFile(parentPath, 'utf-8');
        const parentConfig = yaml.load(parentContent) as Record<string, unknown>;

        // Initialize sub_agents if needed
        if (!parentConfig.sub_agents) {
          parentConfig.sub_agents = [];
        }

        const subAgents = parentConfig.sub_agents as Array<{ config_path: string }>;

        // Check if already a sub-agent
        if (subAgents.some(s => s.config_path === childFilename)) {
          return {
            success: false,
            message: `${childFilename} is already a sub-agent of ${parentFilename}`,
          };
        }

        // Add the child
        subAgents.push({ config_path: childFilename });
        parentConfig.sub_agents = subAgents;

        // Write back
        const updatedYaml = yaml.dump(parentConfig, { lineWidth: -1 });
        await fs.writeFile(parentPath, updatedYaml, 'utf-8');

        return {
          success: true,
          message: `Added ${childFilename} as sub-agent of ${parentFilename}`,
          data: { parentFilename, childFilename },
        };
      }

      case 'add_tool': {
        const agentFilename = args.agentFilename as string;
        const tool = args.tool as string;

        const agentPath = path.join(projectPath, agentFilename);

        // Verify agent exists
        try {
          await fs.access(agentPath);
        } catch {
          return {
            success: false,
            message: `Agent file ${agentFilename} does not exist`,
          };
        }

        // Read agent YAML
        const agentContent = await fs.readFile(agentPath, 'utf-8');
        const agentConfig = yaml.load(agentContent) as Record<string, unknown>;

        // Verify it's an LlmAgent
        if (agentConfig.agent_class !== 'LlmAgent') {
          return {
            success: false,
            message: `Can only add tools to LlmAgent, but ${agentFilename} is ${agentConfig.agent_class}`,
          };
        }

        // Initialize tools if needed
        if (!agentConfig.tools) {
          agentConfig.tools = [];
        }

        const tools = agentConfig.tools as string[];

        // Check if tool already added
        if (tools.includes(tool)) {
          return {
            success: false,
            message: `Tool ${tool} is already added to ${agentFilename}`,
          };
        }

        // Add the tool
        tools.push(tool);

        // Write back
        const updatedYaml = yaml.dump(agentConfig, { lineWidth: -1 });
        await fs.writeFile(agentPath, updatedYaml, 'utf-8');

        return {
          success: true,
          message: `Added tool ${tool} to ${agentFilename}`,
          data: { agentFilename, tool },
        };
      }

      case 'modify_agent': {
        const agentFilename = args.agentFilename as string;
        const agentPath = path.join(projectPath, agentFilename);

        // Verify agent exists
        try {
          await fs.access(agentPath);
        } catch {
          return {
            success: false,
            message: `Agent file ${agentFilename} does not exist`,
          };
        }

        // Read agent YAML
        const agentContent = await fs.readFile(agentPath, 'utf-8');
        const agentConfig = yaml.load(agentContent) as Record<string, unknown>;

        // Apply modifications
        let modified = false;
        if (args.instruction !== undefined) {
          agentConfig.instruction = args.instruction;
          modified = true;
        }
        if (args.description !== undefined) {
          agentConfig.description = args.description;
          modified = true;
        }
        if (args.model !== undefined && agentConfig.agent_class === 'LlmAgent') {
          agentConfig.model = args.model;
          modified = true;
        }

        if (!modified) {
          return {
            success: false,
            message: 'No modifications specified',
          };
        }

        // Write back
        const updatedYaml = yaml.dump(agentConfig, { lineWidth: -1 });
        await fs.writeFile(agentPath, updatedYaml, 'utf-8');

        return {
          success: true,
          message: `Modified agent ${agentFilename}`,
          data: { agentFilename },
        };
      }

      case 'create_python_tool': {
        const name = args.name as string;
        const code = args.code as string;
        const addToAgent = args.addToAgent as string | undefined;

        const toolsDir = path.join(projectPath, 'tools');
        const toolPath = path.join(toolsDir, `${name}.py`);

        // Ensure tools directory exists
        await fs.mkdir(toolsDir, { recursive: true });

        // Write tool file
        await fs.writeFile(toolPath, code, 'utf-8');

        // Ensure __init__.py exists
        const initPath = path.join(toolsDir, '__init__.py');
        try {
          await fs.access(initPath);
        } catch {
          await fs.writeFile(initPath, '', 'utf-8');
        }

        let result: ToolResult = {
          success: true,
          message: `Created Python tool ${name}.py`,
          data: { filename: `${name}.py` },
        };

        // If addToAgent specified, add the tool reference
        if (addToAgent) {
          const agentPath = path.join(projectPath, addToAgent);
          try {
            const agentContent = await fs.readFile(agentPath, 'utf-8');
            const agentConfig = yaml.load(agentContent) as Record<string, unknown>;

            if (!agentConfig.tools) {
              agentConfig.tools = [];
            }

            const tools = agentConfig.tools as string[];
            const toolRef = `tools/${name}.py`;
            if (!tools.includes(toolRef)) {
              tools.push(toolRef);
              const updatedYaml = yaml.dump(agentConfig, { lineWidth: -1 });
              await fs.writeFile(agentPath, updatedYaml, 'utf-8');
              result.message += ` and added to ${addToAgent}`;
            }
          } catch (err) {
            result.message += ` (warning: could not add to ${addToAgent}: ${err})`;
          }
        }

        return result;
      }

      case 'test_python_tool': {
        const toolName = args.toolName as string;
        const testCode = args.testCode as string;
        const toolsDir = path.join(projectPath, 'tools');
        const testFilePath = path.join(toolsDir, `test_${toolName}_temp.py`);

        // Check if tool file exists
        const toolPath = path.join(toolsDir, `${toolName}.py`);
        try {
          await fs.access(toolPath);
        } catch {
          return {
            success: false,
            message: `Tool file ${toolName}.py does not exist. Create it first.`,
          };
        }

        // Write test file
        // We add some setup to ensure import works from the tools dir context
        const wrappedTestCode = `
import sys
import os
sys.path.append(os.getcwd())
try:
${testCode.split('\n').map(line => '    ' + line).join('\n')}
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
`;
        await fs.writeFile(testFilePath, wrappedTestCode, 'utf-8');

        // Run the test
        try {
          // We run it from the project directory so "tools.xxx" imports might need adjustment
          // or we run from tools directory?
          // If the tool code uses "from tools.foo import bar", we need to be in parent.
          // Let's assume standard import structure.
          
          // Actually, if we run inside 'tools' dir, import should be just 'import my_tool'.
          // If we run from project dir, it should be 'from tools import my_tool'.
          
          // Let's run from project directory
          const { stdout, stderr } = await execAsync(`python3 tools/test_${toolName}_temp.py`, {
            cwd: projectPath,
            timeout: 5000, // 5s timeout
          });

          return {
            success: true,
            message: 'Test executed successfully',
            data: { stdout, stderr },
          };
        } catch (err: any) {
          return {
            success: false,
            message: `Test execution failed: ${err.message}`,
            data: { stdout: err.stdout, stderr: err.stderr },
          };
        } finally {
          // Cleanup test file
          try {
            await fs.unlink(testFilePath);
          } catch {}
        }
      }

      case 'read_file': {
        const relativePath = args.path as string;
        // Basic security check to prevent traversal up
        if (relativePath.includes('..')) {
           return { success: false, message: 'Invalid path: cannot contain ".."' };
        }
        
        const fullPath = path.join(projectPath, relativePath);
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          return {
            success: true,
            message: `Read ${relativePath}`,
            data: { content },
          };
        } catch (e) {
          return {
            success: false,
            message: `Failed to read file ${relativePath}: ${e instanceof Error ? e.message : 'Unknown error'}`,
          };
        }
      }

      case 'list_agents': {
        const agentYamls = await readProjectAgentYamls(projectName);
        const agents: Array<{ filename: string; name: string; agentClass: string; hasSubAgents: boolean }> = [];

        for (const [filename, content] of agentYamls) {
          try {
            const config = yaml.load(content) as Record<string, unknown>;
            agents.push({
              filename,
              name: config.name as string,
              agentClass: config.agent_class as string,
              hasSubAgents: Array.isArray(config.sub_agents) && (config.sub_agents as unknown[]).length > 0,
            });
          } catch {
            // Skip invalid YAML
          }
        }

        return {
          success: true,
          message: `Found ${agents.length} agents in project`,
          data: { agents },
        };
      }

      case 'read_agent': {
        const filename = args.filename as string;
        const agentPath = path.join(projectPath, filename);

        try {
          const content = await fs.readFile(agentPath, 'utf-8');
          const config = yaml.load(content) as Record<string, unknown>;
          return {
            success: true,
            message: `Read agent ${filename}`,
            data: { filename, yaml: content, config },
          };
        } catch {
          return {
            success: false,
            message: `Agent file ${filename} does not exist or cannot be read`,
          };
        }
      }

      case 'delete_agent': {
        const filename = args.filename as string;
        const agentPath = path.join(projectPath, filename);

        // Verify agent exists
        try {
          await fs.access(agentPath);
        } catch {
          return {
            success: false,
            message: `Agent file ${filename} does not exist`,
          };
        }

        // Delete the file
        await fs.unlink(agentPath);

        return {
          success: true,
          message: `Deleted agent file ${filename}`,
          data: { filename },
        };
      }

      case 'remove_tool': {
        const agentFilename = args.agentFilename as string;
        const tool = args.tool as string;

        const agentPath = path.join(projectPath, agentFilename);

        // Verify agent exists
        try {
          await fs.access(agentPath);
        } catch {
          return {
            success: false,
            message: `Agent file ${agentFilename} does not exist`,
          };
        }

        // Read agent YAML
        const agentContent = await fs.readFile(agentPath, 'utf-8');
        const agentConfig = yaml.load(agentContent) as Record<string, unknown>;

        // Verify it's an LlmAgent
        if (agentConfig.agent_class !== 'LlmAgent') {
          return {
            success: false,
            message: `Can only remove tools from LlmAgent, but ${agentFilename} is ${agentConfig.agent_class}`,
          };
        }

        // Check if tools array exists
        if (!agentConfig.tools || !Array.isArray(agentConfig.tools)) {
          return {
            success: false,
            message: `Agent ${agentFilename} has no tools to remove`,
          };
        }

        const tools = agentConfig.tools as string[];
        const toolIndex = tools.indexOf(tool);

        if (toolIndex === -1) {
          return {
            success: false,
            message: `Tool ${tool} is not in ${agentFilename}'s tools list`,
          };
        }

        // Remove the tool
        tools.splice(toolIndex, 1);

        // Write back
        const updatedYaml = yaml.dump(agentConfig, { lineWidth: -1 });
        await fs.writeFile(agentPath, updatedYaml, 'utf-8');

        return {
          success: true,
          message: `Removed tool ${tool} from ${agentFilename}`,
          data: { agentFilename, tool },
        };
      }

      case 'remove_sub_agent': {
        const parentFilename = args.parentFilename as string;
        const childFilename = args.childFilename as string;

        const parentPath = path.join(projectPath, parentFilename);

        // Verify parent exists
        try {
          await fs.access(parentPath);
        } catch {
          return {
            success: false,
            message: `Parent agent file ${parentFilename} does not exist`,
          };
        }

        // Read parent YAML
        const parentContent = await fs.readFile(parentPath, 'utf-8');
        const parentConfig = yaml.load(parentContent) as Record<string, unknown>;

        // Check if sub_agents array exists
        if (!parentConfig.sub_agents || !Array.isArray(parentConfig.sub_agents)) {
          return {
            success: false,
            message: `Agent ${parentFilename} has no sub-agents to remove`,
          };
        }

        const subAgents = parentConfig.sub_agents as Array<{ config_path: string }>;
        const subAgentIndex = subAgents.findIndex(s => s.config_path === childFilename);

        if (subAgentIndex === -1) {
          return {
            success: false,
            message: `${childFilename} is not a sub-agent of ${parentFilename}`,
          };
        }

        // Remove the sub-agent
        subAgents.splice(subAgentIndex, 1);

        // Write back
        const updatedYaml = yaml.dump(parentConfig, { lineWidth: -1 });
        await fs.writeFile(parentPath, updatedYaml, 'utf-8');

        return {
          success: true,
          message: `Removed ${childFilename} from ${parentFilename}'s sub-agents`,
          data: { parentFilename, childFilename },
        };
      }

      case 'task_complete': {
        // task_complete will be validated by the main loop which checks for recent failures
        return {
          success: true,
          message: args.summary as string,
          data: { completed: true },
        };
      }

      default:
        return {
          success: false,
          message: `Unknown tool: ${toolName}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error executing ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// System prompt for the AI assistant
const SYSTEM_PROMPT = `You are an AI Builder Assistant for Google ADK (Agent Development Kit). You help users build AI agents through natural language conversation.

## Your Capabilities:
You have access to tools that let you CREATE, READ, MODIFY, and DELETE agent configurations. 
**NEW**: You can now CREATE and TEST custom Python tools.

## Available Agent Classes:
${Object.entries(AGENT_CLASSES).map(([name, desc]) => `- **${name}**: ${desc}`).join('\n')}

## Built-in Tools (for LlmAgent):
${BUILTIN_TOOLS.map(t => `- ${t}`).join('\n')}

## Popular MCP Servers:
${MCP_SERVERS.map(s => `- **${s.name}**: ${s.description}`).join('\n')}

## CRITICAL WORKFLOW RULES - YOU MUST FOLLOW THESE EXACTLY:

### THE GOLDEN RULE: CREATE BEFORE CONNECT
Both the PARENT agent and the CHILD agent must ALREADY EXIST before you can use add_sub_agent to connect them.

### Correct Workflow for Hierarchies:
Step 1: Create ALL leaf agents (the agents that will be children)
Step 2: Create ALL container agents (ParallelAgent, SequentialAgent, LoopAgent)
Step 3: Connect children to their parents using add_sub_agent
Step 4: Call task_complete with a summary

### Example - Creating
`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: projectName } = await params;
    const body = await req.json();
    const validation = AssistantRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.message }, { status: 400 });
    }

    const { message, context, history = [] } = validation.data;
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: toolDefinitions }],
    });

    const chat = model.startChat({
        history: history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }))
    });

    let result = await chat.sendMessage(message);
    let response = await result.response;
    const executedActions: ExecutedAction[] = [];
    
    let functionCalls = response.functionCalls();

    while (functionCalls && functionCalls.length > 0) {
        const toolParts: any[] = [];
        
        for (const call of functionCalls) {
            const toolName = call.name;
            const args = call.args;
            
            const toolResult = await executeTool(projectName, toolName, args as any);
            executedActions.push({
                tool: toolName,
                args: args as any,
                result: toolResult
            });
            
            toolParts.push({
                functionResponse: {
                    name: toolName,
                    response: {
                        name: toolName,
                        content: toolResult
                    }
                }
            });
        }
        
        result = await chat.sendMessage(toolParts);
        response = await result.response;
        functionCalls = response.functionCalls();
    }

    return NextResponse.json({
        response: response.text(),
        actions: executedActions
    });

  } catch (error) {
    console.error('Error in assistant:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}