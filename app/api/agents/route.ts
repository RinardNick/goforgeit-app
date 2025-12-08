import { NextRequest, NextResponse } from 'next/server';
import { listADKAgents, checkADKHealth } from '@/lib/adk';
import { Storage } from '@google-cloud/storage';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');
const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'nicholasrinard-adk-agents';
const USE_GCS = process.env.NODE_ENV === 'production';

// Initialize GCS client
const storage = USE_GCS ? new Storage() : null;

/**
 * GET /api/agents
 * List all available ADK agents from the backend
 */
export async function GET(req: NextRequest) {
  try {
    // Check if ADK backend is available
    const isHealthy = await checkADKHealth();
    if (!isHealthy) {
      return NextResponse.json(
        {
          error: 'ADK backend unavailable',
          hint: 'Make sure the ADK server is running: make dev-adk',
          agents: [],
        },
        { status: 503 }
      );
    }

    // List all ADK agents
    const agentNames = await listADKAgents();

    // Transform to a more useful format
    const agents = agentNames.map((name) => ({
      id: name,
      name: name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      source: 'adk' as const,
    }));

    return NextResponse.json({
      agents,
      total: agents.length,
      source: 'adk',
    });
  } catch (error) {
    console.error('Error listing ADK agents:', error);
    return NextResponse.json(
      {
        error: 'Failed to list ADK agents',
        details: error instanceof Error ? error.message : 'Unknown error',
        agents: [],
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents
 * Create a new ADK agent project
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    // Validate project name (snake_case, alphanumeric with underscores)
    const validNamePattern = /^[a-z][a-z0-9_]*$/;
    if (!validNamePattern.test(name)) {
      return NextResponse.json(
        { error: 'Project name must be lowercase, start with a letter, and contain only letters, numbers, and underscores' },
        { status: 400 }
      );
    }

    // Match Google ADK builder format: name, model, agent_class, description, instruction, sub_agents, tools
    // NOTE: We don't create __init__.py - Google's ADK builder doesn't create it either
    // The adk web server loads agents directly from YAML files
    const rootAgentYaml = `name: root_agent
model: gemini-2.5-flash
agent_class: LlmAgent
description: Main entry point for the ${name.replace(/_/g, ' ')} agent
instruction: |
  You are a helpful AI assistant.
sub_agents: []
tools: []
`;

    if (USE_GCS && storage) {
      // Production: Write to GCS
      const bucket = storage.bucket(GCS_BUCKET);

      // Check if agent already exists
      const [rootExists] = await bucket.file(`${name}/root_agent.yaml`).exists();
      if (rootExists) {
        return NextResponse.json(
          { error: `Project already exists: ${name}` },
          { status: 409 }
        );
      }

      // Upload root agent YAML to GCS
      await bucket.file(`${name}/root_agent.yaml`).save(rootAgentYaml);

      console.log(`Created agent ${name} in GCS bucket ${GCS_BUCKET}`);
    } else {
      // Local: Write to filesystem
      const projectDir = path.join(ADK_AGENTS_DIR, name);

      // Check if project already exists
      try {
        await fs.access(projectDir);
        return NextResponse.json(
          { error: `Project already exists: ${name}` },
          { status: 409 }
        );
      } catch {
        // Directory doesn't exist, which is what we want
      }

      // Create the project directory
      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(path.join(projectDir, 'root_agent.yaml'), rootAgentYaml, 'utf-8');

      console.log(`Created agent ${name} in filesystem at ${projectDir}`);
    }

    return NextResponse.json({
      success: true,
      name,
      message: `Project ${name} created successfully`,
    });
  } catch (error) {
    console.error('Error creating ADK agent project:', error);
    return NextResponse.json(
      {
        error: 'Failed to create ADK agent project',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
