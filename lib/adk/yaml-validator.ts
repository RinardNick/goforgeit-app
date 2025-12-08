/**
 * YAML Schema Validator for ADK Agent Configuration Files
 *
 * Validates agent YAML files against the ADK schema to catch errors before saving.
 * Based on Google ADK documentation and observed patterns.
 */

import YAML from 'yaml';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// Valid agent classes in ADK
const VALID_AGENT_CLASSES = [
  'LlmAgent',
  'LoopAgent',
  'SequentialAgent',
  'ParallelAgent',
  'FallbackAgent',
];

// Valid models
const VALID_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-pro',
  'gemini-flash',
];

// Built-in tools (no configuration needed)
const BUILTIN_TOOLS = [
  'google_search',
  'built_in_code_execution',
  'exit_loop',
  'get_user_choice',
  'load_artifacts',
  'load_memory',
  'preload_memory',
  'url_context',
  'transfer_to_agent',
  'escalate',
  'EnterpriseWebSearchTool',
  'VertexAiSearchTool',
  'FilesRetrieval',
  'VertexAiRagRetrieval',
  'LongRunningFunctionTool',
];

// Tools that require configuration
const CONFIGURABLE_TOOLS = [
  'AgentTool',
  'FunctionTool',
];

/**
 * Validate an agent YAML string
 */
export function validateAgentYAML(yamlString: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  try {
    // Parse YAML
    const agent = YAML.parse(yamlString);

    if (!agent || typeof agent !== 'object') {
      errors.push({
        field: 'root',
        message: 'YAML must contain a valid agent configuration object',
        severity: 'error',
      });
      return { valid: false, errors, warnings };
    }

    // Required fields for all agents
    if (!agent.name || typeof agent.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Agent name is required and must be a string',
        severity: 'error',
      });
    } else if (!/^[a-z0-9_]+$/.test(agent.name)) {
      warnings.push({
        field: 'name',
        message: 'Agent name should only contain lowercase letters, numbers, and underscores',
        severity: 'warning',
      });
    }

    if (!agent.agent_class || typeof agent.agent_class !== 'string') {
      errors.push({
        field: 'agent_class',
        message: 'agent_class is required and must be a string',
        severity: 'error',
      });
    } else if (!VALID_AGENT_CLASSES.includes(agent.agent_class)) {
      errors.push({
        field: 'agent_class',
        message: `Invalid agent_class: ${agent.agent_class}. Must be one of: ${VALID_AGENT_CLASSES.join(', ')}`,
        severity: 'error',
      });
    }

    // Model validation (optional but recommended for LlmAgent)
    if (agent.model) {
      if (typeof agent.model !== 'string') {
        errors.push({
          field: 'model',
          message: 'model must be a string',
          severity: 'error',
        });
      } else if (!VALID_MODELS.includes(agent.model)) {
        warnings.push({
          field: 'model',
          message: `Model ${agent.model} may not be supported. Recommended models: ${VALID_MODELS.join(', ')}`,
          severity: 'warning',
        });
      }
    } else if (agent.agent_class === 'LlmAgent') {
      warnings.push({
        field: 'model',
        message: 'LlmAgent should specify a model (e.g., gemini-2.5-flash)',
        severity: 'warning',
      });
    }

    // Instruction field (required for LlmAgent)
    if (agent.agent_class === 'LlmAgent') {
      if (!agent.instruction) {
        errors.push({
          field: 'instruction',
          message: 'LlmAgent requires an instruction field',
          severity: 'error',
        });
      } else if (typeof agent.instruction !== 'string') {
        errors.push({
          field: 'instruction',
          message: 'instruction must be a string',
          severity: 'error',
        });
      }
    }

    // Description (optional)
    if (agent.description && typeof agent.description !== 'string') {
      errors.push({
        field: 'description',
        message: 'description must be a string',
        severity: 'error',
      });
    }

    // sub_agents validation
    if (agent.sub_agents !== undefined) {
      if (!Array.isArray(agent.sub_agents)) {
        errors.push({
          field: 'sub_agents',
          message: 'sub_agents must be an array',
          severity: 'error',
        });
      } else {
        agent.sub_agents.forEach((subAgent: any, index: number) => {
          if (typeof subAgent === 'object' && subAgent.config_path) {
            if (typeof subAgent.config_path !== 'string') {
              errors.push({
                field: `sub_agents[${index}].config_path`,
                message: 'config_path must be a string',
                severity: 'error',
              });
            } else if (!subAgent.config_path.startsWith('./')) {
              warnings.push({
                field: `sub_agents[${index}].config_path`,
                message: 'config_path should start with ./ for ADK compatibility',
                severity: 'warning',
              });
            } else if (!subAgent.config_path.endsWith('.yaml')) {
              warnings.push({
                field: `sub_agents[${index}].config_path`,
                message: 'config_path should reference a .yaml file',
                severity: 'warning',
              });
            }
          } else {
            errors.push({
              field: `sub_agents[${index}]`,
              message: 'Sub-agent must have a config_path field',
              severity: 'error',
            });
          }
        });
      }
    }

    // tools validation
    if (agent.tools !== undefined) {
      if (!Array.isArray(agent.tools)) {
        errors.push({
          field: 'tools',
          message: 'tools must be an array',
          severity: 'error',
        });
      } else {
        agent.tools.forEach((tool: any, index: number) => {
          // Tool can be either a string (builtin) or object with name field
          if (typeof tool === 'string') {
            // Direct string reference (deprecated but sometimes used)
            warnings.push({
              field: `tools[${index}]`,
              message: `Tool should be an object with 'name' field, not a string. Use: - name: ${tool}`,
              severity: 'warning',
            });
          } else if (typeof tool === 'object' && tool.name) {
            const toolName = tool.name;

            // Check if it's a known builtin or configurable tool
            const isBuiltin = BUILTIN_TOOLS.includes(toolName);
            const isConfigurable = CONFIGURABLE_TOOLS.includes(toolName);

            if (isConfigurable && toolName === 'AgentTool') {
              // Validate AgentTool structure
              if (!tool.args || !tool.args.agent || !tool.args.agent.config_path) {
                errors.push({
                  field: `tools[${index}].args`,
                  message: 'AgentTool requires args.agent.config_path',
                  severity: 'error',
                });
              }
              if (tool.args && tool.args.skip_summarization === undefined) {
                warnings.push({
                  field: `tools[${index}].args.skip_summarization`,
                  message: 'AgentTool should specify skip_summarization (defaults to false)',
                  severity: 'warning',
                });
              }
            } else if (isConfigurable && toolName === 'FunctionTool') {
              // Validate FunctionTool structure
              if (!tool.args || (!tool.args.function_name && !tool.args.fn)) {
                errors.push({
                  field: `tools[${index}].args`,
                  message: 'FunctionTool requires args.function_name or args.fn',
                  severity: 'error',
                });
              }
            } else if (!isBuiltin && !isConfigurable) {
              // Unknown tool - might be a custom tool
              warnings.push({
                field: `tools[${index}].name`,
                message: `Unknown tool: ${toolName}. Make sure it's defined as a custom tool.`,
                severity: 'warning',
              });
            }
          } else {
            errors.push({
              field: `tools[${index}]`,
              message: 'Tool must have a name field',
              severity: 'error',
            });
          }
        });
      }
    }

    // Field ordering validation (warning only)
    const expectedOrder = ['name', 'model', 'agent_class', 'description', 'instruction', 'sub_agents', 'tools'];
    const actualFields = Object.keys(agent);
    const orderedFields = actualFields.filter(f => expectedOrder.includes(f));
    const expectedOrderedFields = expectedOrder.filter(f => actualFields.includes(f));

    if (JSON.stringify(orderedFields) !== JSON.stringify(expectedOrderedFields)) {
      warnings.push({
        field: 'field_order',
        message: `Fields should follow ADK convention: ${expectedOrder.join(', ')}`,
        severity: 'warning',
      });
    }

  } catch (error) {
    errors.push({
      field: 'yaml_parse',
      message: `Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push('❌ Errors:');
    result.errors.forEach(err => {
      lines.push(`  • ${err.field}: ${err.message}`);
    });
  }

  if (result.warnings.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('⚠️  Warnings:');
    result.warnings.forEach(warn => {
      lines.push(`  • ${warn.field}: ${warn.message}`);
    });
  }

  return lines.join('\n');
}
