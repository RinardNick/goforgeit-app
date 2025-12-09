import { NextRequest, NextResponse } from 'next/server';
import {
  readAgentFile,
  writeAgentFile,
  deleteAgentFile,
  ensureEvalsDir,
} from '@/lib/storage';

// GET /api/agents/[name]/evaluations/[id]/config - Load metrics configuration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name: agentName, id: evalsetId } = await params;

    const configContent = await readAgentFile(agentName, `evaluations/${evalsetId}.config.json`);

    if (configContent) {
      const config = JSON.parse(configContent);
      return NextResponse.json({
        config,
        hasCustomConfig: true,
      });
    } else {
      // Config file doesn't exist, return defaults
      return NextResponse.json({
        config: null,
        hasCustomConfig: false,
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
    await ensureEvalsDir(agentName);
    await writeAgentFile(
      agentName,
      `evaluations/${evalsetId}.config.json`,
      JSON.stringify(config, null, 2),
      'application/json'
    );

    return NextResponse.json({
      success: true,
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

    // Try to delete the config file
    const deleted = await deleteAgentFile(agentName, `evaluations/${evalsetId}.config.json`);

    if (deleted) {
      return NextResponse.json({
        success: true,
        message: 'Reset to defaults',
      });
    } else {
      // File might not exist, which is fine
      return NextResponse.json({
        success: true,
        message: 'Already using defaults',
      });
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
