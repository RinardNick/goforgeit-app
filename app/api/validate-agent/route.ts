import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';

/**
 * POST /api/validate-agent
 * Validate agent YAML using ADK's Pydantic schema validation
 *
 * Request body: { yaml: string }
 * Response: { valid: boolean, errors: ValidationError[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { yaml } = body;

    if (!yaml || typeof yaml !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid yaml field' },
        { status: 400 }
      );
    }

    // Path to Python validator script
    const validatorPath = path.join(process.cwd(), 'adk-service', 'validate_agent.py');

    // Run Python validator with YAML as stdin
    let result: string;
    try {
      result = execSync(`python3 "${validatorPath}"`, {
        input: yaml,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
    } catch (error: any) {
      // Python script exits with non-zero for invalid YAML
      // The validation result is still in stdout
      if (error.stdout) {
        result = error.stdout;
      } else {
        throw error;
      }
    }

    const validationResult = JSON.parse(result);
    return NextResponse.json(validationResult);
  } catch (error) {
    console.error('Error validating agent YAML:', error);

    return NextResponse.json(
      {
        valid: false,
        errors: [{
          type: 'schema_validation_error',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          field: undefined,
          value: undefined,
        }],
      },
      { status: 500 }
    );
  }
}
