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
const SYSTEM_AGENTS_BASE_PATH = process.env.SYSTEM_AGENTS_BASE_PATH || path.join(process.cwd(), 'adk-service', 'system_agents');

// Helper to decide mode
function useBackend() {
  return process.env.NODE_ENV === 'production';
}

// Helper: Dual Write for System Agents
// If we modify a file in agents/, and it corresponds to a system agent, mirror the write to system_agents/
async function writeWithMirror(fs: typeof fsPromises, filePath: string, content: string) {
  // 1. Write to runtime path
  await fs.writeFile(filePath, content, 'utf-8');

  // 2. Check if this is a system agent
  // We identify system agents by checking if they are in the 'builder_agent' folder
  // Note: We moved forge_agent inside builder_agent, so checking 'builder_agent' covers both.
  
  const relativePath = path.relative(ADK_AGENTS_BASE_PATH, filePath);
  
  if (relativePath.startsWith('builder_agent')) {
    const systemPath = path.join(SYSTEM_AGENTS_BASE_PATH, relativePath);
    
    // Ensure directory exists in system path (it should, but be safe)
    try {
      await fs.mkdir(path.dirname(systemPath), { recursive: true });
      await fs.writeFile(systemPath, content, 'utf-8');
      console.log(`[BuilderTools] Mirrored write to system agent: ${relativePath}`);
    } catch (err) {
      console.warn(`[BuilderTools] Failed to mirror system agent write: ${err}`);
    }
  }
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
      try {
        await fs.access(filePath);
        return { success: false, message: `Agent file ${filename} already exists` };
      } catch {
        // Proceed
      }

      await writeWithMirror(fs, filePath, yamlContent);
      
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

      await writeWithMirror(fs, parentPath, yaml.stringify(parentConfig));

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

      await writeWithMirror(fs, filePath, yaml.stringify(config));

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
        await writeWithMirror(fs, filePath, yaml.stringify(config));
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
        await writeWithMirror(fs, filePath, yaml.stringify(config));
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
    
    // Protect system agents
    if (filename.includes('builder_agent') || filename.includes('forge_agent')) {
      return { success: false, message: 'Cannot delete system agents (builder_agent, forge_agent).' };
    }

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

export const createPythonToolTool = (deps: ToolDependencies = DEFAULT_DEPS) => ai.defineTool(
  {
    name: 'create_python_tool',
    description: 'Create a custom Python function tool file.',
    inputSchema: z.object({
      projectName: z.string(),
      name: z.string(),
      code: z.string(),
      addToAgent: z.string().optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      data: z.any().optional(),
    }),
  },
  async ({ projectName, name, code, addToAgent }) => {
    const fs = deps.fs!;
    if (useBackend()) return { success: false, message: 'Backend tool creation not implemented yet' };

    try {
      const projectPath = path.join(ADK_AGENTS_BASE_PATH, projectName);
      const toolsDir = path.join(projectPath, 'tools');
      const toolPath = path.join(toolsDir, `${name}.py`);

      try { await fs.mkdir(toolsDir, { recursive: true }); } catch {}

      await writeWithMirror(fs, toolPath, code);

      try {
        try { await fs.access(path.join(toolsDir, '__init__.py')); } catch { await fs.writeFile(path.join(toolsDir, '__init__.py'), '', 'utf-8'); }
      } catch {}

      let message = `Created Python tool ${name}.py`;

      if (addToAgent) {
        const agentPath = path.join(projectPath, addToAgent);
        try {
          const content = await fs.readFile(agentPath, 'utf-8');
          const config = yaml.parse(content);
          
          if (!config.tools) config.tools = [];
          const toolRef = `tools/${name}.py`;
          
          if (!config.tools.includes(toolRef)) {
            config.tools.push(toolRef);
            await writeWithMirror(fs, agentPath, yaml.stringify(config));
            message += ` and added to ${addToAgent}`;
          }
        } catch (err) {
          message += ` (warning: failed to add to agent: ${err})`;
        }
      }

      return {
        success: true,
        message,
        data: { filename: `${name}.py` }
      };
    } catch (error) {
      return { success: false, message: `Failed to create python tool: ${error}` };
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