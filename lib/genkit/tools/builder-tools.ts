import { z } from 'zod';
import path from 'path';
import yaml from 'yaml';
import { promises as fsPromises } from 'fs';
import { ai } from '../index';

// Dependency Interface
interface ToolDependencies {
  fs?: typeof fsPromises;
  fetch?: typeof fetch;
}

const DEFAULT_DEPS: ToolDependencies = {
  fs: fsPromises,
  fetch: global.fetch,
};

// Configuration
const ADK_AGENTS_BASE_PATH = process.env.ADK_AGENTS_BASE_PATH || path.join(process.cwd(), 'adk-service', 'agents');
const ADK_BACKEND_URL = process.env.ADK_BACKEND_URL || 'http://127.0.0.1:8000';

// Helper to decide mode
function useBackend() {
  return process.env.NODE_ENV === 'production';
}

// --- Tools ---

export const listAgentsTool = (deps: ToolDependencies = DEFAULT_DEPS) => ai.defineTool(
  {
    name: 'list_agents',
    description: 'List all agents in the current project.',
    inputSchema: z.object({
      projectName: z.string(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      data: z.any().optional(),
    }),
  },
  async ({ projectName }) => {
    const fs = deps.fs!;
    if (useBackend()) return { success: false, message: 'Backend listing not implemented yet' };

    try {
      const projectPath = path.join(ADK_AGENTS_BASE_PATH, projectName);
      try {
        await fs.access(projectPath);
      } catch {
        return { success: true, message: 'Project not found (empty)', data: { agents: [] } };
      }

      const files = await fs.readdir(projectPath);
      const agents = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
      
      return {
        success: true,
        message: `Found ${agents.length} agents`,
        data: { agents }
      };
    } catch (error) {
      return { success: false, message: `Failed to list agents: ${error}` };
    }
  }
);

export const createAgentTool = (deps: ToolDependencies = DEFAULT_DEPS) => ai.defineTool(
  {
    name: 'create_agent',
    description: 'Create a new agent configuration file.',
    inputSchema: z.object({
      projectName: z.string(),
      name: z.string(),
      agentClass: z.enum(['LlmAgent', 'SequentialAgent', 'ParallelAgent', 'LoopAgent']),
      model: z.string().optional(),
      description: z.string().optional(),
      instruction: z.string().optional(),
      tools: z.array(z.string()).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      data: z.any().optional(),
    }),
  },
  async (input) => {
    const fs = deps.fs!;
    const { projectName, name, agentClass, model, description, instruction, tools } = input;
    const filename = `${name}.yaml`;

    const config: any = {
      name,
      agent_class: agentClass,
    };

    if (agentClass === 'LlmAgent') {
      config.model = model || 'gemini-2.0-flash-exp';
      if (description) config.description = description;
      if (instruction) config.instruction = instruction;
      if (tools) config.tools = tools;
    } else {
      if (description) config.description = description;
      config.sub_agents = [];
    }

    const yamlContent = yaml.stringify(config);

    if (useBackend()) return { success: false, message: 'Backend save not implemented yet' };

    try {
      const projectPath = path.join(ADK_AGENTS_BASE_PATH, projectName);
      try {
        await fs.access(projectPath);
      } catch {
        await fs.mkdir(projectPath, { recursive: true });
      }
      
      const filePath = path.join(projectPath, filename);
      // Check exists? No, overwrite is usually fine for create (or should fail?)
      // Original impl failed if exists. Let's replicate.
      try {
        await fs.access(filePath);
        return { success: false, message: `Agent file ${filename} already exists` };
      } catch {
        // Proceed
      }

      await fs.writeFile(filePath, yamlContent, 'utf-8');
      
      return {
        success: true,
        message: `Created agent ${name}`,
        data: { filename }
      };
    } catch (error) {
      return { success: false, message: `Failed to create agent: ${error}` };
    }
  }
);

export const readAgentTool = (deps: ToolDependencies = DEFAULT_DEPS) => ai.defineTool(
  {
    name: 'read_agent',
    description: 'Read the configuration of an agent.',
    inputSchema: z.object({
      projectName: z.string(),
      filename: z.string(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      data: z.any().optional(),
    }),
  },
  async ({ projectName, filename }) => {
    const fs = deps.fs!;
    if (useBackend()) return { success: false, message: 'Backend read not implemented yet' };

    try {
      const filePath = path.join(ADK_AGENTS_BASE_PATH, projectName, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const config = yaml.parse(content);
      
      return {
        success: true,
        message: `Read agent ${filename}`,
        data: { filename, yaml: content, config }
      };
    } catch (error) {
      return { success: false, message: `Failed to read agent: ${error}` };
    }
  }
);

export const addSubAgentTool = (deps: ToolDependencies = DEFAULT_DEPS) => ai.defineTool(
  {
    name: 'add_sub_agent',
    description: 'Add a sub-agent to a parent agent.',
    inputSchema: z.object({
      projectName: z.string(),
      parentFilename: z.string(),
      childFilename: z.string(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      data: z.any().optional(),
    }),
  },
  async ({ projectName, parentFilename, childFilename }) => {
    const fs = deps.fs!;
    if (useBackend()) return { success: false, message: 'Backend op not implemented yet' };

    try {
      const projectPath = path.join(ADK_AGENTS_BASE_PATH, projectName);
      const parentPath = path.join(projectPath, parentFilename);
      const childPath = path.join(projectPath, childFilename);

      // Verify files exist
      try { await fs.access(parentPath); } catch { return { success: false, message: `Parent ${parentFilename} not found` }; }
      try { await fs.access(childPath); } catch { return { success: false, message: `Child ${childFilename} not found` }; }

      const parentContent = await fs.readFile(parentPath, 'utf-8');
      const parentConfig = yaml.parse(parentContent);

      if (!parentConfig.sub_agents) parentConfig.sub_agents = [];
      const subAgents = parentConfig.sub_agents as Array<{ config_path: string }>;

      if (subAgents.some(s => s.config_path === childFilename)) {
        return { success: false, message: `${childFilename} is already a sub-agent` };
      }

      subAgents.push({ config_path: childFilename });
      parentConfig.sub_agents = subAgents;

      await fs.writeFile(parentPath, yaml.stringify(parentConfig), 'utf-8');

      return {
        success: true,
        message: `Added ${childFilename} as sub-agent of ${parentFilename}`,
        data: { parentFilename, childFilename }
      };
    } catch (error) {
      return { success: false, message: `Failed to add sub-agent: ${error}` };
    }
  }
);

export const modifyAgentTool = (deps: ToolDependencies = DEFAULT_DEPS) => ai.defineTool(
  {
    name: 'modify_agent',
    description: 'Modify an existing agent configuration.',
    inputSchema: z.object({
      projectName: z.string(),
      agentFilename: z.string(),
      instruction: z.string().optional(),
      description: z.string().optional(),
      model: z.string().optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      data: z.any().optional(),
    }),
  },
  async ({ projectName, agentFilename, instruction, description, model }) => {
    const fs = deps.fs!;
    if (useBackend()) return { success: false, message: 'Backend op not implemented yet' };

    try {
      const filePath = path.join(ADK_AGENTS_BASE_PATH, projectName, agentFilename);
      const content = await fs.readFile(filePath, 'utf-8');
      const config = yaml.parse(content);

      if (instruction) config.instruction = instruction;
      if (description) config.description = description;
      if (model && config.agent_class === 'LlmAgent') config.model = model;

      await fs.writeFile(filePath, yaml.stringify(config), 'utf-8');

      return {
        success: true,
        message: `Modified agent ${agentFilename}`,
        data: { agentFilename }
      };
    } catch (error) {
      return { success: false, message: `Failed to modify agent: ${error}` };
    }
  }
);

export const addToolTool = (deps: ToolDependencies = DEFAULT_DEPS) => ai.defineTool(
  {
    name: 'add_tool',
    description: 'Add a tool to an agent.',
    inputSchema: z.object({
      projectName: z.string(),
      agentFilename: z.string(),
      tool: z.string(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      data: z.any().optional(),
    }),
  },
  async ({ projectName, agentFilename, tool }) => {
    const fs = deps.fs!;
    if (useBackend()) return { success: false, message: 'Backend op not implemented yet' };

    try {
      const filePath = path.join(ADK_AGENTS_BASE_PATH, projectName, agentFilename);
      const content = await fs.readFile(filePath, 'utf-8');
      const config = yaml.parse(content);

      if (config.agent_class !== 'LlmAgent') {
        return { success: false, message: 'Can only add tools to LlmAgent' };
      }

      if (!config.tools) config.tools = [];
      if (!config.tools.includes(tool)) {
        config.tools.push(tool);
        await fs.writeFile(filePath, yaml.stringify(config), 'utf-8');
      }

      return {
        success: true,
        message: `Added tool ${tool} to ${agentFilename}`,
        data: { agentFilename, tool }
      };
    } catch (error) {
      return { success: false, message: `Failed to add tool: ${error}` };
    }
  }
);

export const removeToolTool = (deps: ToolDependencies = DEFAULT_DEPS) => ai.defineTool(
  {
    name: 'remove_tool',
    description: 'Remove a tool from an agent.',
    inputSchema: z.object({
      projectName: z.string(),
      agentFilename: z.string(),
      tool: z.string(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      data: z.any().optional(),
    }),
  },
  async ({ projectName, agentFilename, tool }) => {
    const fs = deps.fs!;
    if (useBackend()) return { success: false, message: 'Backend op not implemented yet' };

    try {
      const filePath = path.join(ADK_AGENTS_BASE_PATH, projectName, agentFilename);
      const content = await fs.readFile(filePath, 'utf-8');
      const config = yaml.parse(content);

      if (config.agent_class !== 'LlmAgent') {
        return { success: false, message: 'Can only remove tools from LlmAgent' };
      }

      if (config.tools && config.tools.includes(tool)) {
        config.tools = config.tools.filter((t: string) => t !== tool);
        await fs.writeFile(filePath, yaml.stringify(config), 'utf-8');
      }

      return {
        success: true,
        message: `Removed tool ${tool} from ${agentFilename}`,
        data: { agentFilename, tool }
      };
    } catch (error) {
      return { success: false, message: `Failed to remove tool: ${error}` };
    }
  }
);

export const deleteAgentTool = (deps: ToolDependencies = DEFAULT_DEPS) => ai.defineTool(
  {
    name: 'delete_agent',
    description: 'Delete an agent file.',
    inputSchema: z.object({
      projectName: z.string(),
      filename: z.string(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      data: z.any().optional(),
    }),
  },
  async ({ projectName, filename }) => {
    const fs = deps.fs!;
    if (useBackend()) return { success: false, message: 'Backend delete not implemented yet' };

    try {
      const filePath = path.join(ADK_AGENTS_BASE_PATH, projectName, filename);
      await fs.unlink(filePath);
      return { success: true, message: `Deleted agent ${filename}` };
    } catch (error) {
      return { success: false, message: `Failed to delete agent: ${error}` };
    }
  }
);

export const taskCompleteTool = (deps: ToolDependencies = DEFAULT_DEPS) => ai.defineTool(
  {
    name: 'task_complete',
    description: 'Signal that all requested changes have been completed.',
    inputSchema: z.object({
      summary: z.string(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },
  async ({ summary }) => {
    return { success: true, message: summary };
  }
);
