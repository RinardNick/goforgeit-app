/**
 * YAML Validation for ADK Agents
 *
 * Validates agent configurations, especially config_path references
 */

export interface ValidationError {
  type:
    | 'broken_reference'
    | 'invalid_yaml'
    | 'missing_required_field'
    | 'invalid_field_type'
    | 'invalid_field_value'
    | 'schema_validation_error'
    | 'yaml_syntax_error';
  message: string;
  field?: string;
  value?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Extract all config_path references from agent YAML
 */
export function extractConfigPathReferences(yamlContent: string): string[] {
  const references: string[] = [];

  // Match both sub_agents and AgentTool config_path references
  const patterns = [
    /config_path:\s*([^\s\n]+)/g, // General config_path
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(yamlContent)) !== null) {
      references.push(match[1]);
    }
  }

  return references;
}

/**
 * Normalize a config_path by removing the ./ prefix if present
 */
function normalizeConfigPath(configPath: string): string {
  return configPath.startsWith('./') ? configPath.slice(2) : configPath;
}

/**
 * Validate an agent's YAML configuration
 * Checks that all config_path references point to existing files
 */
export async function validateAgentReferences(
  agentName: string,
  yamlContent: string,
  existingFiles: string[]
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  // Normalize existing files (remove ./ prefix)
  const normalizedExistingFiles = existingFiles.map(normalizeConfigPath);

  // Extract all config_path references
  const references = extractConfigPathReferences(yamlContent);

  // Check each reference exists
  for (const ref of references) {
    const normalizedRef = normalizeConfigPath(ref);
    if (!normalizedExistingFiles.includes(normalizedRef)) {
      errors.push({
        type: 'broken_reference',
        message: `Referenced file '${ref}' not found`,
        field: 'config_path',
        value: ref,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate YAML schema using ADK's Pydantic validator
 * Calls /api/validate-agent which uses the Python script
 */
export async function validateAgentSchema(
  yamlContent: string
): Promise<ValidationResult> {
  try {
    // Determine the base URL based on environment
    const baseUrl = typeof window === 'undefined'
      ? (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050')
      : '';

    // Call validation endpoint
    const response = await fetch(`${baseUrl}/api/validate-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ yaml: yamlContent }),
    });

    if (!response.ok) {
      throw new Error(`Validation endpoint returned ${response.status}`);
    }

    const validationResult = await response.json();
    return validationResult;
  } catch (error: any) {
    // Unexpected error
    return {
      valid: false,
      errors: [{
        type: 'schema_validation_error',
        message: `Schema validation failed: ${error.message}`,
        field: undefined,
        value: undefined,
      }],
    };
  }
}

/**
 * Validate all agents in a project
 * Returns a map of agent name -> validation result
 */
export async function validateProject(
  agents: Array<{ filename: string; yaml: string }>
): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>();
  const allFiles = agents.map(a => a.filename);

  for (const agent of agents) {
    const agentName = agent.filename.replace('.yaml', '');

    // Run both reference validation and schema validation
    const referenceResult = await validateAgentReferences(agentName, agent.yaml, allFiles);
    const schemaResult = await validateAgentSchema(agent.yaml);

    // Combine errors from both validations
    const combinedErrors = [...referenceResult.errors, ...schemaResult.errors];

    results.set(agent.filename, {
      valid: combinedErrors.length === 0,
      errors: combinedErrors,
    });
  }

  return results;
}
