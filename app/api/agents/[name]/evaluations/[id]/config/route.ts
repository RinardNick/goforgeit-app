import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');

async function getEvalsDir(agentName: string): Promise<string> {
  const evalsDir = path.join(ADK_AGENTS_DIR, agentName, 'evaluations');

  // Ensure directory exists
  try {
    await fs.access(evalsDir);
  } catch {
    await fs.mkdir(evalsDir, { recursive: true });
  }

  return evalsDir;
}

// GET /api/agents/[name]/evaluations/[id]/config - Load metrics configuration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name: agentName, id: evalsetId } = await params;

    const evalsDir = await getEvalsDir(agentName);
    const configPath = path.join(evalsDir, `${evalsetId}.config.json`);

    // Check if config file exists
    try {
      await fs.access(configPath);

      // Read and parse config file
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      return NextResponse.json({
        config,
        hasCustomConfig: true,
        configPath,
      });
    } catch {
      // Config file doesn't exist, return defaults
      return NextResponse.json({
        config: null,
        hasCustomConfig: false,
        configPath,
      });
    }
  } catch (error) {
    console.error('Error loading config:', error);
    return NextResponse.json(
      {
        error: 'Failed to load configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/agents/[name]/evaluations/[id]/config - Save metrics configuration
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name: agentName, id: evalsetId } = await params;
    const body = await request.json();
    const { criteria } = body;

    if (!criteria) {
      return NextResponse.json(
        { error: 'Criteria object is required' },
        { status: 400 }
      );
    }

    // Build config object in ADK format
    const config = { criteria };

    // Save to .config.json file
    const evalsDir = await getEvalsDir(agentName);
    const configPath = path.join(evalsDir, `${evalsetId}.config.json`);
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    return NextResponse.json({
      success: true,
      configPath,
      message: 'Configuration saved',
    });
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      {
        error: 'Failed to save configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[name]/evaluations/[id]/config - Reset to default configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name: agentName, id: evalsetId } = await params;

    const evalsDir = await getEvalsDir(agentName);
    const configPath = path.join(evalsDir, `${evalsetId}.config.json`);

    // Try to delete the config file
    try {
      await fs.unlink(configPath);
      return NextResponse.json({
        success: true,
        message: 'Reset to defaults',
      });
    } catch (error) {
      // File might not exist, which is fine
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return NextResponse.json({
          success: true,
          message: 'Already using defaults',
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error deleting config:', error);
    return NextResponse.json(
      {
        error: 'Failed to reset configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
