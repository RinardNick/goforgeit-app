import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { validateProject } from '@/lib/adk/validation';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: agentName } = await params;

  try {
    const agentDir = path.join(ADK_AGENTS_DIR, agentName);

    // Check if agent directory exists
    try {
      await fs.access(agentDir);
    } catch {
      return NextResponse.json(
        { error: `Agent directory not found: ${agentName}` },
        { status: 404 }
      );
    }

    // Read all YAML files in the agent directory
    const files = await fs.readdir(agentDir);
    const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

    const agents = [];
    for (const filename of yamlFiles) {
      const filePath = path.join(agentDir, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      agents.push({
        filename,
        yaml: content,
      });
    }

    // Validate all agents
    const validationResults = await validateProject(agents);

    // Convert Map to object for JSON response
    const results: Record<string, any> = {};
    validationResults.forEach((result, filename) => {
      results[filename] = result;
    });

    // Determine overall project validity
    const allValid = Array.from(validationResults.values()).every(r => r.valid);

    return NextResponse.json({
      valid: allValid,
      results,
      totalAgents: agents.length,
      totalErrors: Array.from(validationResults.values()).reduce((sum, r) => sum + r.errors.length, 0),
    });
  } catch (error) {
    console.error('Error validating agent project:', error);
    return NextResponse.json(
      {
        error: 'Failed to validate agent project',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
