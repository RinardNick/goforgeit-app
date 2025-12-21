import { NextRequest, NextResponse } from 'next/server';
import { listADKAgents, checkADKHealth } from '@/lib/adk';
import { Storage } from '@google-cloud/storage';
import fs from 'fs/promises';
import path from 'path';
import { auth } from '@/auth';
import { ensureUserOrg } from '@/lib/db/utils';
import { query } from '@/lib/db/client';

export const runtime = 'nodejs';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');
const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'nicholasrinard-adk-agents';
const USE_GCS = process.env.NODE_ENV === 'production';

// Initialize GCS client
const storage = USE_GCS ? new Storage() : null;

/**
 * GET /api/agents
 * List all available ADK agents from the backend (filtered by organization and optionally project)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure user has an organization
    const org = await ensureUserOrg(session.user.email);

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

    // List all ADK agents from backend (source of truth for running code)
    const allAgentNames = await listADKAgents();

    // Get allowed agents for this org (and project if specified)
    const projectId = req.nextUrl.searchParams.get('projectId');

    let allowedAgents: { name: string, project_id: string }[];
    
    if (projectId) {
      allowedAgents = await query<{ name: string, project_id: string }>(
        'SELECT name, project_id FROM agents WHERE org_id = $1 AND project_id = $2',
        [org.id, projectId]
      );
    } else {
      allowedAgents = await query<{ name: string, project_id: string }>(
        'SELECT name, project_id FROM agents WHERE org_id = $1',
        [org.id]
      );
    }
    
    const allowedNames = new Set(allowedAgents.map(a => a.name));

    // Filter agents: Only show agents that exist both on backend AND in our DB for this org
    const agents = allAgentNames
      .filter(name => allowedNames.has(name))
      .map((name) => ({
        id: name,
        name: name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        source: 'adk' as const,
        projectId: allowedAgents.find(a => a.name === name)?.project_id
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
 * Create a new ADK agent within a project
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure user has an organization
    const org = await ensureUserOrg(session.user.email);

    const body = await req.json();
    const { name, projectId } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      );
    }

    // Verify project belongs to org if projectId is provided
    if (projectId) {
      const project = await query(
        'SELECT id FROM projects WHERE id = $1 AND org_id = $2',
        [projectId, org.id]
      );

      if (project.length === 0) {
        return NextResponse.json(
          { error: 'Project not found or access denied' },
          { status: 403 }
        );
      }
    }

    // Validate agent name (snake_case, alphanumeric with underscores)
    const validNamePattern = /^[a-z][a-z0-9_]*$/;
    if (!validNamePattern.test(name)) {
      return NextResponse.json(
        { error: 'Agent name must be lowercase, start with a letter, and contain only letters, numbers, and underscores' },
        { status: 400 }
      );
    }

    // Match Google ADK builder format: name, model, agent_class, description, instruction, sub_agents, tools
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
          { error: `Agent already exists: ${name}` },
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
          { error: `Agent already exists: ${name}` },
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

    // Link agent to project in DB
    await query(
      'INSERT INTO agents (name, org_id, project_id) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
      [name, org.id, projectId]
    );

    return NextResponse.json({
      success: true,
      name,
      message: `Agent ${name} created successfully`,
    });
  } catch (error) {
    console.error('Error creating ADK agent:', error);
    return NextResponse.json(
      {
        error: 'Failed to create ADK agent',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}