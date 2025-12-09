import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { Storage } from '@google-cloud/storage';
import YAML from 'yaml';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');
const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'goforgeit-adk-agents';
const USE_GCS = process.env.NODE_ENV === 'production';

// Initialize GCS client (lazy)
let storage: Storage | null = null;
function getStorage(): Storage {
  if (!storage) {
    storage = new Storage();
  }
  return storage;
}

// Helper to read a file from GCS or filesystem
async function readAgentFile(agentName: string, filename: string): Promise<string | null> {
  if (USE_GCS) {
    const bucket = getStorage().bucket(GCS_BUCKET);
    const file = bucket.file(`${agentName}/${filename}`);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [content] = await file.download();
    return content.toString('utf-8');
  } else {
    const filePath = path.join(ADK_AGENTS_DIR, agentName, filename);
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }
}

// Helper to write a file to GCS or filesystem
async function writeAgentFile(agentName: string, filename: string, content: string): Promise<void> {
  if (USE_GCS) {
    const bucket = getStorage().bucket(GCS_BUCKET);
    await bucket.file(`${agentName}/${filename}`).save(content, { contentType: 'text/yaml' });
  } else {
    const filePath = path.join(ADK_AGENTS_DIR, agentName, filename);
    await fs.writeFile(filePath, content, 'utf-8');
  }
}

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

    // Verify both files exist
    const parentContent = await readAgentFile(agentName, parentFilename);
    if (!parentContent) {
      return NextResponse.json(
        { error: `Parent file not found: ${parentFilename}` },
        { status: 404 }
      );
    }

    const childContent = await readAgentFile(agentName, childFilename);
    if (!childContent) {
      return NextResponse.json(
        { error: `Child file not found: ${childFilename}` },
        { status: 404 }
      );
    }

    // Parse the parent YAML
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
    await writeAgentFile(agentName, parentFilename, updatedContent);

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

    // Verify parent file exists
    const parentContent = await readAgentFile(agentName, parentFilename);
    if (!parentContent) {
      return NextResponse.json(
        { error: `Parent file not found: ${parentFilename}` },
        { status: 404 }
      );
    }

    // Parse the parent YAML
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
    await writeAgentFile(agentName, parentFilename, updatedContent);

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
    const { searchParams } = new URL(request.url);
    const parentFilename = searchParams.get('parentFilename');
    const childFilename = searchParams.get('childFilename');

    if (!parentFilename || !childFilename) {
      return NextResponse.json(
        { error: 'parentFilename and childFilename query params are required' },
        { status: 400 }
      );
    }

    // Verify parent file exists
    const parentContent = await readAgentFile(agentName, parentFilename);
    if (!parentContent) {
      return NextResponse.json(
        { error: `Parent file not found: ${parentFilename}` },
        { status: 404 }
      );
    }

    // Parse the parent YAML
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
    await writeAgentFile(agentName, parentFilename, updatedContent);

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
