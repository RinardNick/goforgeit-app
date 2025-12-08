import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType, FunctionCallingMode, Content, FunctionDeclaration } from '@google/generative-ai';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';

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
You have access to tools that let you CREATE, READ, MODIFY, and DELETE agent configurations. Use these tools to fulfill user requests.

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

### Example - Creating "A ParallelAgent with two LlmAgent children":
1. create_agent(name="child_1", agentClass="LlmAgent", ...)  // Create child 1
2. create_agent(name="child_2", agentClass="LlmAgent", ...)  // Create child 2
3. create_agent(name="parallel_parent", agentClass="ParallelAgent", ...)  // Create container
4. add_sub_agent(parentFilename="parallel_parent.yaml", childFilename="child_1.yaml")  // Connect
5. add_sub_agent(parentFilename="parallel_parent.yaml", childFilename="child_2.yaml")  // Connect
6. task_complete(summary="Created parallel_parent with child_1 and child_2")

### COMMON MISTAKES TO AVOID:
- DO NOT call add_sub_agent until BOTH parent and child files exist
- DO NOT call task_complete until ALL connections are made
- If add_sub_agent fails saying "does not exist", you forgot to create that agent first - CREATE IT, then retry add_sub_agent

### Error Recovery:
If you see an error like "Parent agent file X.yaml does not exist" or "Child agent file X.yaml does not exist":
1. CREATE the missing agent using create_agent
2. THEN retry the add_sub_agent call

### Tool Execution:
- Execute ONE tool at a time and wait for its result
- Read the result carefully to know if it succeeded or failed
- Only call task_complete when ALL work is truly done

## Important Rules:
- Always use snake_case for agent and tool names
- For LlmAgent, always include a model (default: gemini-2.0-flash-exp)
- Be concise but helpful in your explanations
- If you're unsure about something, ask for clarification`;

/**
 * POST /api/agents/[name]/assistant
 * Chat with the AI Builder Assistant using an agentic loop
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: projectName } = await params;

  try {
    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const validation = AssistantRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { message, context, history } = validation.data;

    // Read the actual YAML files from the project directory
    const agentYamls = await readProjectAgentYamls(projectName);
    const pythonTools = await readProjectPythonTools(projectName);

    // Build comprehensive context for the assistant
    let projectContextStr = `\n\n## Project: "${projectName}"\n`;
    projectContextStr += `Directory: adk-service/agents/${projectName}/\n`;

    // List all agents with summary
    if (context.agents.length > 0) {
      projectContextStr += `\n### Agents in this project (${context.agents.length}):\n`;
      for (const agent of context.agents) {
        projectContextStr += `- **${agent.name}** (${agent.agentClass}) - ${agent.filename}\n`;
      }
    } else {
      projectContextStr += '\n### Agents: None yet.\n';
    }

    // Include full YAML content for all agents
    if (agentYamls.size > 0) {
      projectContextStr += `\n### Agent YAML Configurations:\n`;
      for (const [filename, content] of agentYamls) {
        projectContextStr += `\n#### ${filename}:\n\`\`\`yaml\n${content}\n\`\`\`\n`;
      }
    }

    // Include Python tools
    if (pythonTools.size > 0) {
      projectContextStr += `\n### Custom Python Tools (in tools/ directory):\n`;
      for (const [filename, content] of pythonTools) {
        projectContextStr += `\n#### ${filename}:\n\`\`\`python\n${content}\n\`\`\`\n`;
      }
    }

    // Highlight the currently selected agent
    let selectedAgentContext = '';
    if (context.selectedAgent) {
      selectedAgentContext = `\n## Currently Selected/Focused Agent:\n`;
      selectedAgentContext += `**${context.selectedAgent.name}** (${context.selectedAgent.filename})\n`;
      selectedAgentContext += `\nWhen the user asks to add tools, sub-agents, or make modifications without specifying an agent, apply changes to this agent.\n`;

      // Include the selected agent's YAML prominently
      const selectedYaml = agentYamls.get(context.selectedAgent.filename);
      if (selectedYaml) {
        selectedAgentContext += `\nSelected agent's current configuration:\n\`\`\`yaml\n${selectedYaml}\n\`\`\`\n`;
      }
    }

    // Initialize Gemini with function calling
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY environment variable not configured' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: toolDefinitions }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingMode.AUTO,
        },
      },
    });

    // Build the project context message that will be injected at the start
    const projectContextMessage = projectContextStr + selectedAgentContext;

    // Build chat history with project context as the first exchange
    const chatHistory: Content[] = [
      { role: 'user', parts: [{ text: `Here is the current project context:\n${projectContextMessage}\n\nI need help building agents for this project.` }] },
      { role: 'model', parts: [{ text: 'I understand the project context. I can see the agents, their configurations, and any custom tools. I have tools available to create agents, add sub-agents, modify configurations, and more. How can I help you today?' }] },
      ...(history || []).map(h => ({
        role: h.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: h.content }],
      })),
    ];

    // Start chat
    const chat = model.startChat({
      history: chatHistory,
    });

    // Agentic loop - continue until task_complete or max iterations
    const MAX_ITERATIONS = 15;
    const executedActions: ExecutedAction[] = [];
    let finalResponse = '';
    let isComplete = false;

    // Send initial message and get first response
    let currentResult = await chat.sendMessage(message);

    for (let iteration = 0; iteration < MAX_ITERATIONS && !isComplete; iteration++) {
      const response = currentResult.response;
      const candidates = response.candidates;

      if (!candidates || candidates.length === 0) {
        finalResponse = 'No response generated';
        break;
      }

      const parts = candidates[0].content.parts;

      // Check for function calls
      const functionCalls = parts.filter(part => 'functionCall' in part);

      if (functionCalls.length === 0) {
        // No function calls - this is a text response
        const textParts = parts.filter(part => 'text' in part);
        finalResponse = textParts.map(p => 'text' in p ? p.text : '').join('\n');
        break;
      }

      // Execute each function call
      const functionResponses: Array<{ functionResponse: { name: string; response: ToolResult } }> = [];

      for (const part of functionCalls) {
        if ('functionCall' in part && part.functionCall) {
          const fc = part.functionCall;
          const toolName = fc.name;
          const args = fc.args as Record<string, unknown>;

          console.log(`[AI Assistant] Executing tool: ${toolName}`, args);

          // Execute the tool
          const toolResult = await executeTool(projectName, toolName, args);

          console.log(`[AI Assistant] Tool result:`, toolResult);

          executedActions.push({
            tool: toolName,
            args,
            result: toolResult,
          });

          functionResponses.push({
            functionResponse: {
              name: toolName,
              response: toolResult,
            },
          });

          // Check if task is complete
          if (toolName === 'task_complete' && toolResult.success) {
            // Check for unresolved failures - a failure is unresolved if:
            // 1. It failed AND
            // 2. There's no subsequent success with the same tool+arguments
            const unresolvedFailures: ExecutedAction[] = [];

            for (let i = 0; i < executedActions.length; i++) {
              const action = executedActions[i];
              if (!action.result.success) {
                // Check if there's a subsequent success that resolves this failure
                const isResolved = executedActions.slice(i + 1).some(
                  later => later.tool === action.tool &&
                           later.result.success &&
                           JSON.stringify(later.args) === JSON.stringify(action.args)
                );
                if (!isResolved) {
                  unresolvedFailures.push(action);
                }
              }
            }

            if (unresolvedFailures.length > 0) {
              // Override the result to tell the LLM there were failures
              const failedTools = unresolvedFailures.map(a => `${a.tool}(${JSON.stringify(a.args)}): ${a.result.message}`).join('; ');
              functionResponses[functionResponses.length - 1].functionResponse.response = {
                success: false,
                message: `Cannot complete task - there are ${unresolvedFailures.length} unresolved failures: ${failedTools}. Please resolve these issues and try task_complete again.`,
              };
            } else {
              isComplete = true;
              finalResponse = toolResult.message;
            }
          }
        }
      }

      // Send function responses back to the model and get next response
      if (!isComplete && functionResponses.length > 0) {
        currentResult = await chat.sendMessage(functionResponses);
      }
    }

    // Build the response
    return NextResponse.json({
      response: finalResponse,
      executedActions,
      isComplete,
    });
  } catch (error) {
    console.error('Error in AI assistant:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
