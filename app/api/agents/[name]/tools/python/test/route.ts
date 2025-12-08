import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { z } from 'zod';

export const runtime = 'nodejs';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');

// Schema for testing a Python tool
const TestPythonToolSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  params: z.record(z.unknown()).optional(), // Optional parameters to pass to the function
});

/**
 * POST /api/agents/[name]/tools/python/test
 * Test a Python tool by executing it with given parameters
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: agentName } = await params;

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

    const validation = TestPythonToolSchema.safeParse(body);
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

    const { filename, params: toolParams } = validation.data;

    const agentDir = path.join(ADK_AGENTS_DIR, agentName);
    const toolsDir = path.join(agentDir, 'tools');
    const filePath = path.join(toolsDir, filename);

    // Security check
    if (!filePath.startsWith(toolsDir)) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json(
        { error: `Tool file not found: ${filename}` },
        { status: 404 }
      );
    }

    // Read the tool code to get the function name
    const code = await fs.readFile(filePath, 'utf-8');
    const funcMatch = code.match(/^def\s+(\w+)\s*\(/m);
    if (!funcMatch) {
      return NextResponse.json(
        { error: 'Could not find function definition in tool file' },
        { status: 400 }
      );
    }
    const functionName = funcMatch[1];

    // Create a test script that imports and executes the tool
    const paramsJson = JSON.stringify(toolParams || {});
    const testScript = `
import sys
import json
import traceback

# Add the tools directory to the path
sys.path.insert(0, '${toolsDir.replace(/\\/g, '\\\\')}')

try:
    # Import the module
    from ${filename.replace('.py', '')} import ${functionName}

    # Parse parameters
    params = json.loads('''${paramsJson}''')

    # Execute the function
    result = ${functionName}(**params)

    # Output the result as JSON
    print(json.dumps({
        "success": True,
        "result": result
    }))
except Exception as e:
    print(json.dumps({
        "success": False,
        "error": str(e),
        "traceback": traceback.format_exc()
    }))
`;

    // Execute the Python script
    const result = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
      const python = spawn('python3', ['-c', testScript], {
        cwd: toolsDir,
        timeout: 30000, // 30 second timeout
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        resolve({ stdout, stderr, code: code || 0 });
      });

      python.on('error', (error) => {
        resolve({ stdout: '', stderr: error.message, code: 1 });
      });
    });

    // Parse the result
    if (result.code !== 0 && !result.stdout) {
      return NextResponse.json({
        success: false,
        error: 'Python execution failed',
        stderr: result.stderr,
        exitCode: result.code,
      });
    }

    try {
      const output = JSON.parse(result.stdout.trim());
      if (output.success) {
        return NextResponse.json({
          success: true,
          result: output.result,
          stderr: result.stderr || undefined,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: output.error,
          traceback: output.traceback,
          stderr: result.stderr || undefined,
        });
      }
    } catch {
      // If JSON parsing fails, return raw output
      return NextResponse.json({
        success: false,
        error: 'Failed to parse tool output',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.code,
      });
    }
  } catch (error) {
    console.error('Error testing Python tool:', error);
    return NextResponse.json(
      { error: 'Failed to test Python tool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
