import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import YAML from 'yaml';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');

interface SubAgent {
  config_path?: string;
  name?: string;
}

interface AgentYaml {
  name: string;
  agent_class: string;
  model?: string;
  description?: string;
  instruction?: string;
  sub_agents?: SubAgent[];
}

// POST - Create a connection (add sub_agent to parent)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: agentName } = await params;
    const body = await request.json();
    const { parentFilename, childFilename } = body;

    if (!parentFilename || !childFilename) {
      return NextResponse.json(
        { error: 'parentFilename and childFilename are required' },
        { status: 400 }
      );
    }

    const agentDir = path.join(ADK_AGENTS_DIR, agentName);

    // Verify both files exist
    const parentPath = path.join(agentDir, parentFilename);
    const childPath = path.join(agentDir, childFilename);

    try {
      await fs.access(parentPath);
    } catch {
      return NextResponse.json(
        { error: `Parent file not found: ${parentFilename}` },
        { status: 404 }
      );
    }

    try {
      await fs.access(childPath);
    } catch {
      return NextResponse.json(
        { error: `Child file not found: ${childFilename}` },
        { status: 404 }
      );
    }

    // Read the parent YAML
    const parentContent = await fs.readFile(parentPath, 'utf-8');
    const parentYaml = YAML.parse(parentContent) as AgentYaml;

    // Check if the connection already exists
    const existingSubAgents = parentYaml.sub_agents || [];
    const alreadyConnected = existingSubAgents.some(
      (sub) => sub.config_path === childFilename
    );

    if (alreadyConnected) {
      return NextResponse.json(
        { error: 'Connection already exists', alreadyConnected: true },
        { status: 400 }
      );
    }

    // Add the new sub_agent
    parentYaml.sub_agents = [...existingSubAgents, { config_path: childFilename }];

    // Write the updated YAML
    const updatedContent = YAML.stringify(parentYaml);
    await fs.writeFile(parentPath, updatedContent, 'utf-8');

    console.log(`Created connection: ${parentFilename} -> ${childFilename}`);

    return NextResponse.json({
      success: true,
      parentFilename,
      childFilename,
      message: `Added ${childFilename} as sub_agent of ${parentFilename}`,
    });
  } catch (error) {
    console.error('Error creating connection:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create connection' },
      { status: 500 }
    );
  }
}

// PATCH - Reorder a sub_agent within parent's sub_agents array
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: agentName } = await params;
    const body = await request.json();
    const { parentFilename, childFilename, newIndex } = body;

    if (!parentFilename || !childFilename || newIndex === undefined) {
      return NextResponse.json(
        { error: 'parentFilename, childFilename, and newIndex are required' },
        { status: 400 }
      );
    }

    const agentDir = path.join(ADK_AGENTS_DIR, agentName);
    const parentPath = path.join(agentDir, parentFilename);

    // Verify parent file exists
    try {
      await fs.access(parentPath);
    } catch {
      return NextResponse.json(
        { error: `Parent file not found: ${parentFilename}` },
        { status: 404 }
      );
    }

    // Read the parent YAML
    const parentContent = await fs.readFile(parentPath, 'utf-8');
    const parentYaml = YAML.parse(parentContent) as AgentYaml;

    // Check if sub_agents exists and the child is in the array
    const existingSubAgents = parentYaml.sub_agents || [];
    const currentIndex = existingSubAgents.findIndex(
      (sub) => sub.config_path === childFilename
    );

    if (currentIndex === -1) {
      return NextResponse.json(
        { error: `Child not found in sub_agents: ${childFilename}` },
        { status: 404 }
      );
    }

    // Validate newIndex
    if (newIndex < 0 || newIndex >= existingSubAgents.length) {
      return NextResponse.json(
        { error: `Invalid newIndex: ${newIndex}. Must be between 0 and ${existingSubAgents.length - 1}` },
        { status: 400 }
      );
    }

    // Remove from current position and insert at new position
    const [movedItem] = existingSubAgents.splice(currentIndex, 1);
    existingSubAgents.splice(newIndex, 0, movedItem);

    parentYaml.sub_agents = existingSubAgents;

    // Write the updated YAML
    const updatedContent = YAML.stringify(parentYaml);
    await fs.writeFile(parentPath, updatedContent, 'utf-8');

    console.log(`Reordered ${childFilename} from index ${currentIndex} to ${newIndex} in ${parentFilename}`);

    return NextResponse.json({
      success: true,
      parentFilename,
      childFilename,
      oldIndex: currentIndex,
      newIndex,
      message: `Moved ${childFilename} from position ${currentIndex} to ${newIndex}`,
    });
  } catch (error) {
    console.error('Error reordering sub_agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reorder sub_agent' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a connection (remove sub_agent from parent)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: agentName } = await params;
    const reqUrl = new URL(request.url);
    const parentFilename = reqUrl.searchParams.get('parentFilename');
    const childFilename = reqUrl.searchParams.get('childFilename');

    if (!parentFilename || !childFilename) {
      return NextResponse.json(
        { error: 'parentFilename and childFilename query params are required' },
        { status: 400 }
      );
    }

    const agentDir = path.join(ADK_AGENTS_DIR, agentName);
    const parentPath = path.join(agentDir, parentFilename);

    // Verify parent file exists
    try {
      await fs.access(parentPath);
    } catch {
      return NextResponse.json(
        { error: `Parent file not found: ${parentFilename}` },
        { status: 404 }
      );
    }

    // Read the parent YAML
    const parentContent = await fs.readFile(parentPath, 'utf-8');
    const parentYaml = YAML.parse(parentContent) as AgentYaml;

    // Check if the connection exists
    const existingSubAgents = parentYaml.sub_agents || [];
    const connectionIndex = existingSubAgents.findIndex(
      (sub) => sub.config_path === childFilename
    );

    if (connectionIndex === -1) {
      return NextResponse.json(
        { error: 'Connection not found', notFound: true },
        { status: 404 }
      );
    }

    // Remove the sub_agent
    existingSubAgents.splice(connectionIndex, 1);

    // If no more sub_agents, remove the array entirely
    if (existingSubAgents.length === 0) {
      delete parentYaml.sub_agents;
    } else {
      parentYaml.sub_agents = existingSubAgents;
    }

    // Write the updated YAML
    const updatedContent = YAML.stringify(parentYaml);
    await fs.writeFile(parentPath, updatedContent, 'utf-8');

    console.log(`Deleted connection: ${parentFilename} -> ${childFilename}`);

    return NextResponse.json({
      success: true,
      parentFilename,
      childFilename,
      message: `Removed ${childFilename} from sub_agents of ${parentFilename}`,
    });
  } catch (error) {
    console.error('Error deleting connection:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete connection' },
      { status: 500 }
    );
  }
}
