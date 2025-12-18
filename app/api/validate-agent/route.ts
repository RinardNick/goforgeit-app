import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';

const VALIDATE_SCRIPT = path.join(process.cwd(), 'adk-service', 'validate_agent.py');

/**
 * POST /api/validate-agent
 * Validates agent YAML using ADK's Pydantic schema via Python script
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { yaml: yamlContent } = body;

    if (!yamlContent) {
      return NextResponse.json(
        { valid: false, errors: [{ type: 'missing_input', message: 'YAML content is required' }] },
        { status: 400 }
      );
    }

    // Call Python validation script
    const result = await validateWithPython(yamlContent);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error validating agent:', error);
    return NextResponse.json(
      {
        valid: false,
        errors: [{
          type: 'validation_error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }],
      },
      { status: 500 }
    );
  }
}

/**
 * Call Python validation script with YAML content via stdin
 */
function validateWithPython(yamlContent: string): Promise<{ valid: boolean; errors: Array<{ type: string; message: string; field?: string; value?: string }> }> {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [VALIDATE_SCRIPT]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (stderr && !stdout) {
        // Python error (import error, script error, etc.)
        resolve({
          valid: false,
          errors: [{
            type: 'validation_error',
            message: `Python validation error: ${stderr.trim()}`,
          }],
        });
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch {
        resolve({
          valid: false,
          errors: [{
            type: 'validation_error',
            message: `Failed to parse validation result: ${stdout || stderr}`,
          }],
        });
      }
    });

    python.on('error', (err) => {
      resolve({
        valid: false,
        errors: [{
          type: 'validation_error',
          message: `Failed to run Python validator: ${err.message}`,
        }],
      });
    });

    // Send YAML content to stdin
    python.stdin.write(yamlContent);
    python.stdin.end();
  });
}
