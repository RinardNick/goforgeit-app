import { NextRequest, NextResponse } from 'next/server';
import { getADKAgentYAML, saveADKAgentYAML, checkADKHealth } from '@/lib/adk/client';
import { validateAgentSchema } from '@/lib/adk/validation';

export const runtime = 'nodejs';

/**
 * GET /api/adk-agents/[name]/yaml
 * Fetch the YAML configuration for an ADK agent
 *
 * Now uses ADK client which routes through /api/adk-router
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: agentName } = await params;

  try {
    // Check if ADK backend is available
    const isHealthy = await checkADKHealth();
    if (!isHealthy) {
      return NextResponse.json(
        {
          error: 'ADK backend unavailable',
          hint: 'Make sure the ADK server is running: make dev-adk',
        },
        { status: 503 }
      );
    }

    // Fetch YAML via ADK client (routes through /api/adk-router)
    const yaml = await getADKAgentYAML(agentName);

    return NextResponse.json({
      agentName,
      yaml,
      source: 'adk',
    });
  } catch (error) {
    console.error('Error fetching ADK agent YAML:', error);

    // Check if it's a 404 error
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json(
        { error: `Agent '${agentName}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch agent YAML',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/adk-agents/[name]/yaml
 * Save the YAML configuration for an ADK agent
 *
 * Now uses ADK client which routes through /api/adk-router
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: agentName } = await params;

    // Check if ADK backend is available
    const isHealthy = await checkADKHealth();
    if (!isHealthy) {
      return NextResponse.json(
        {
          error: 'ADK backend unavailable',
          hint: 'Make sure the ADK server is running: make dev-adk',
        },
        { status: 503 }
      );
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { yaml } = body;
    if (!yaml || typeof yaml !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid yaml field' },
        { status: 400 }
      );
    }

    // TEMP: Disable validation to test actual ADK behavior
    // const validationResult = await validateAgentSchema(yaml);
    // if (!validationResult.valid) {
    //   return NextResponse.json(
    //     {
    //       error: 'Invalid agent configuration',
    //       validation_errors: validationResult.errors,
    //     },
    //     { status: 400 }
    //   );
    // }

    // Save YAML via ADK client (routes through /api/adk-router)
    await saveADKAgentYAML(agentName, yaml);

    return NextResponse.json({
      success: true,
      agentName,
      message: 'Agent configuration saved successfully',
    });
  } catch (error) {
    console.error('Error saving ADK agent YAML:', error);

    return NextResponse.json(
      {
        error: 'Failed to save agent YAML',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
