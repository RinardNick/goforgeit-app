import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

export const runtime = 'nodejs';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');

// Schema for creating a new Python tool
const CreatePythonToolSchema = z.object({
  name: z.string().min(1, 'Tool name is required'),
  code: z.string().min(1, 'Python code is required'),
});

// Schema for updating a Python tool
const UpdatePythonToolSchema = z.object({
  code: z.string().min(1, 'Python code is required'),
});

// Interface for parsed function signature
interface FunctionSignature {
  name: string;
  params: Array<{
    name: string;
    type: string;
    required: boolean;
    default?: string;
  }>;
  docstring?: string;
  returnType?: string;
}

// Interface for Python tool info
interface PythonToolInfo {
  filename: string;
  name: string;
  code: string;
  signature?: FunctionSignature;
  enabled: boolean;
}

/**
 * Extract function signature from Python code
 * This is a simple parser - for complex cases, consider using a Python subprocess
 */
function extractFunctionSignature(code: string): FunctionSignature | undefined {
  // Match function definition with optional type hints
  const funcDefRegex = /^def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/m;
  const match = code.match(funcDefRegex);

  if (!match) {
    return undefined;
  }

  const funcName = match[1];
  const paramsStr = match[2];
  const returnType = match[3]?.trim();

  // Parse parameters
  const params: FunctionSignature['params'] = [];
  if (paramsStr.trim()) {
    // Split by comma, but handle nested brackets (for Dict[str, str], etc.)
    const paramsList = splitParams(paramsStr);

    for (const param of paramsList) {
      const trimmed = param.trim();
      if (!trimmed || trimmed === 'self') continue;

      // Parse parameter: name: type = default
      const paramMatch = trimmed.match(/^(\w+)(?:\s*:\s*([^=]+?))?(?:\s*=\s*(.+))?$/);
      if (paramMatch) {
        params.push({
          name: paramMatch[1],
          type: paramMatch[2]?.trim() || 'Any',
          required: paramMatch[3] === undefined,
          default: paramMatch[3]?.trim(),
        });
      }
    }
  }

  // Extract docstring
  const docstringRegex = /^def\s+\w+\s*\([^)]*\)[^:]*:\s*\n\s*(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')/m;
  const docMatch = code.match(docstringRegex);
  const docstring = docMatch ? (docMatch[1] || docMatch[2])?.trim() : undefined;

  return {
    name: funcName,
    params,
    docstring,
    returnType,
  };
}

/**
 * Split parameters respecting nested brackets
 */
function splitParams(paramsStr: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of paramsStr) {
    if (char === ',' && depth === 0) {
      result.push(current);
      current = '';
    } else {
      if (char === '[' || char === '(' || char === '{') {
        depth++;
      } else if (char === ']' || char === ')' || char === '}') {
        depth--;
      }
      current += char;
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}

/**
 * GET /api/adk-agents/[name]/tools/python
 * List all Python tool files for an agent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: agentName } = await params;

  try {
    const agentDir = path.join(ADK_AGENTS_DIR, agentName);
    const toolsDir = path.join(agentDir, 'tools');

    // Check if agent directory exists
    try {
      await fs.access(agentDir);
    } catch {
      return NextResponse.json(
        { error: `Agent directory not found: ${agentName}` },
        { status: 404 }
      );
    }

    // Check if tools directory exists, create if not
    try {
      await fs.access(toolsDir);
    } catch {
      // Tools directory doesn't exist yet, return empty list
      return NextResponse.json({
        agentName,
        tools: [],
      });
    }

    // Read all Python files in the tools directory
    const files = await fs.readdir(toolsDir);
    const pythonFiles = files.filter(f => f.endsWith('.py'));

    const tools: PythonToolInfo[] = [];

    for (const filename of pythonFiles) {
      const filePath = path.join(toolsDir, filename);
      const code = await fs.readFile(filePath, 'utf-8');
      const signature = extractFunctionSignature(code);

      tools.push({
        filename,
        name: filename.replace('.py', ''),
        code,
        signature,
        enabled: true, // All existing tools are enabled by default
      });
    }

    return NextResponse.json({
      agentName,
      tools,
    });
  } catch (error) {
    console.error('Error reading Python tools:', error);
    return NextResponse.json(
      { error: 'Failed to read Python tools' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/adk-agents/[name]/tools/python
 * Create a new Python tool file
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

    const validation = CreatePythonToolSchema.safeParse(body);
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

    const { name: toolName, code } = validation.data;

    const agentDir = path.join(ADK_AGENTS_DIR, agentName);
    const toolsDir = path.join(agentDir, 'tools');

    // Ensure agent directory exists
    try {
      await fs.access(agentDir);
    } catch {
      return NextResponse.json(
        { error: `Agent directory not found: ${agentName}` },
        { status: 404 }
      );
    }

    // Ensure tools directory exists
    try {
      await fs.access(toolsDir);
    } catch {
      await fs.mkdir(toolsDir, { recursive: true });
    }

    // Generate filename from tool name
    const sanitizedName = toolName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    let filename = `${sanitizedName}.py`;
    let filePath = path.join(toolsDir, filename);

    // Security check
    if (!filePath.startsWith(toolsDir)) {
      return NextResponse.json(
        { error: 'Invalid tool name' },
        { status: 400 }
      );
    }

    // Check if file already exists
    try {
      await fs.access(filePath);
      return NextResponse.json(
        { error: `Tool file already exists: ${filename}` },
        { status: 409 }
      );
    } catch {
      // File doesn't exist, which is what we want
    }

    // Write the Python file
    await fs.writeFile(filePath, code, 'utf-8');

    // Extract signature from the code
    const signature = extractFunctionSignature(code);

    return NextResponse.json({
      success: true,
      tool: {
        filename,
        name: sanitizedName,
        code,
        signature,
        enabled: true,
      },
    });
  } catch (error) {
    console.error('Error creating Python tool:', error);
    return NextResponse.json(
      { error: 'Failed to create Python tool' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/adk-agents/[name]/tools/python?filename=tool_name.py
 * Update an existing Python tool file
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: agentName } = await params;
  const reqUrl = new URL(request.url);
  const filename = reqUrl.searchParams.get('filename');

  if (!filename) {
    return NextResponse.json(
      { error: 'filename query parameter is required' },
      { status: 400 }
    );
  }

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

    const validation = UpdatePythonToolSchema.safeParse(body);
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

    const { code } = validation.data;

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

    // Write the updated code
    await fs.writeFile(filePath, code, 'utf-8');

    // Extract signature from the updated code
    const signature = extractFunctionSignature(code);

    return NextResponse.json({
      success: true,
      tool: {
        filename,
        name: filename.replace('.py', ''),
        code,
        signature,
        enabled: true,
      },
    });
  } catch (error) {
    console.error('Error updating Python tool:', error);
    return NextResponse.json(
      { error: 'Failed to update Python tool' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/adk-agents/[name]/tools/python?filename=tool_name.py
 * Delete a Python tool file
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: agentName } = await params;
  const reqUrl = new URL(request.url);
  const filename = reqUrl.searchParams.get('filename');

  if (!filename) {
    return NextResponse.json(
      { error: 'filename query parameter is required' },
      { status: 400 }
    );
  }

  try {
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

    // Delete the file
    await fs.unlink(filePath);

    return NextResponse.json({
      success: true,
      filename,
    });
  } catch (error) {
    console.error('Error deleting Python tool:', error);
    return NextResponse.json(
      { error: 'Failed to delete Python tool' },
      { status: 500 }
    );
  }
}
