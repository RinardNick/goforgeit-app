import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');
const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'nicholasrinard-adk-agents';
const USE_GCS = process.env.NODE_ENV === 'production';

// Initialize GCS client
const storage = USE_GCS ? new Storage() : null;

interface AgentFile {
  filename: string;
  yaml: string;
}

interface AgentData {
  name: string;
  agentClass: string;
  model?: string;
  description?: string;
  instruction?: string;
}

// Helper function to update config_path references in all YAML files when a file is renamed
async function updateParentReferences(
  agentDir: string,
  oldFilename: string,
  newFilename: string
): Promise<void> {
  // Read all YAML files in the directory
  const files = await fs.readdir(agentDir);
  const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

  for (const filename of yamlFiles) {
    // Skip the file being renamed (it won't have a reference to itself)
    if (filename === oldFilename || filename === newFilename) continue;

    const filePath = path.join(agentDir, filename);
    const content = await fs.readFile(filePath, 'utf-8');

    // Escape special regex characters in the filename
    const escapedOldFilename = oldFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Check if this file references the old filename
    if (content.includes(`config_path: ${oldFilename}`)) {
      // Replace the old reference with the new one (using escaped regex)
      const updatedContent = content.replace(
        new RegExp(`config_path: ${escapedOldFilename}`, 'g'),
        `config_path: ${newFilename}`
      );
      await fs.writeFile(filePath, updatedContent, 'utf-8');
      console.log(`Updated config_path reference in ${filename}: ${oldFilename} -> ${newFilename}`);
    }
  }
}

// Helper function to generate __init__.py for adk eval compatibility
async function generateInitPy(agentDir: string, agentName: string): Promise<void> {
  const initPyPath = path.join(agentDir, '__init__.py');

  const initPyContent = `"""
Auto-generated __init__.py for ${agentName}

This file makes the agent compatible with 'adk eval' by exposing the root agent
as a Python module attribute.
"""

from google.adk.agents import config_agent_utils
import os

_config_path = os.path.join(os.path.dirname(__file__), "root_agent.yaml")
root_agent = config_agent_utils.from_config(_config_path)

class agent:
    """Module-like object to satisfy adk eval's import requirements"""
    root_agent = root_agent
`;

  await fs.writeFile(initPyPath, initPyContent, 'utf-8');
  console.log(`Generated __init__.py for ${agentName}`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: agentName } = await params;

  try {
    const agentFiles: AgentFile[] = [];

    if (USE_GCS && storage) {
      // Production: Read from GCS
      const bucket = storage.bucket(GCS_BUCKET);
      const [files] = await bucket.getFiles({ prefix: `${agentName}/` });

      if (files.length === 0) {
        return NextResponse.json(
          { error: `Agent directory not found: ${agentName}` },
          { status: 404 }
        );
      }

      // Filter for YAML files
      const yamlFiles = files.filter(f =>
        f.name.endsWith('.yaml') || f.name.endsWith('.yml')
      );

      for (const file of yamlFiles) {
        const [content] = await file.download();
        const filename = path.basename(file.name);
        agentFiles.push({
          filename,
          yaml: content.toString('utf-8'),
        });
      }
    } else {
      // Local: Read from filesystem
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

      for (const filename of yamlFiles) {
        const filePath = path.join(agentDir, filename);
        const content = await fs.readFile(filePath, 'utf-8');
        agentFiles.push({
          filename,
          yaml: content,
        });
      }
    }

    return NextResponse.json({
      agentName,
      files: agentFiles,
    });
  } catch (error) {
    console.error('Error reading agent files:', error);
    return NextResponse.json(
      { error: 'Failed to read agent files' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: agentName } = await params;

  try {
    const body = await request.json();
    const { filename, yaml } = body;

    if (!filename || !yaml) {
      return NextResponse.json(
        { error: 'filename and yaml are required' },
        { status: 400 }
      );
    }

    if (USE_GCS && storage) {
      // Production: Write to GCS
      const bucket = storage.bucket(GCS_BUCKET);
      const file = bucket.file(`${agentName}/${filename}`);
      await file.save(yaml, { contentType: 'text/yaml' });
    } else {
      // Local: Write to filesystem
      const agentDir = path.join(ADK_AGENTS_DIR, agentName);
      const filePath = path.join(agentDir, filename);

      // Ensure the file is within the agent directory (security check)
      if (!filePath.startsWith(agentDir)) {
        return NextResponse.json(
          { error: 'Invalid filename' },
          { status: 400 }
        );
      }

      await fs.writeFile(filePath, yaml, 'utf-8');

      // Regenerate __init__.py to ensure it's up to date
      await generateInitPy(agentDir, agentName);
    }

    return NextResponse.json({
      success: true,
      filename,
    });
  } catch (error) {
    console.error('Error saving agent file:', error);
    return NextResponse.json(
      { error: 'Failed to save agent file' },
      { status: 500 }
    );
  }
}

// POST - Create a new agent YAML file from structured data
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: agentName } = await params;

  try {
    const body = await request.json() as AgentData & { filename?: string };
    const { name, agentClass, model, description, instruction, filename: providedFilename } = body;

    if (!name || !agentClass) {
      return NextResponse.json(
        { error: 'name and agentClass are required' },
        { status: 400 }
      );
    }

    // Generate filename from agent name if not provided
    let baseFilename = providedFilename || `${name.toLowerCase().replace(/\s+/g, '_')}.yaml`;
    let filename = baseFilename;

    if (USE_GCS && storage) {
      // Production: Check if agent exists in GCS and find unique filename
      const bucket = storage.bucket(GCS_BUCKET);
      const [agentFiles] = await bucket.getFiles({ prefix: `${agentName}/` });

      if (agentFiles.length === 0) {
        return NextResponse.json(
          { error: `Agent directory not found: ${agentName}` },
          { status: 404 }
        );
      }

      // Find unique filename
      let counter = 1;
      while (agentFiles.some(f => f.name === `${agentName}/${filename}`)) {
        const baseName = baseFilename.replace('.yaml', '');
        filename = `${baseName}_${counter}.yaml`;
        counter++;
      }
    } else {
      // Local: Check filesystem
      const agentDir = path.join(ADK_AGENTS_DIR, agentName);

      // Ensure agent directory exists
      try {
        await fs.access(agentDir);
      } catch {
        return NextResponse.json(
          { error: `Agent directory not found: ${agentName}` },
          { status: 404 }
        );
      }

      // Find unique filename
      let filePath = path.join(agentDir, filename);
      let counter = 1;
      while (true) {
        try {
          await fs.access(filePath);
          const baseName = baseFilename.replace('.yaml', '');
          filename = `${baseName}_${counter}.yaml`;
          filePath = path.join(agentDir, filename);
          counter++;
        } catch {
          break;
        }
      }
    }

    // Build the YAML object with exact field ordering to match Google ADK builder
    // Order: name, model, agent_class, [description], instruction, sub_agents, tools
    const agentYamlName = filename.replace('.yaml', '');
    const agentObj: Record<string, unknown> = {
      name: agentYamlName,
    };

    // Model comes before agent_class in Google's format
    if (model) agentObj.model = model;

    agentObj.agent_class = agentClass;

    // Description is optional but comes after agent_class
    if (description) agentObj.description = description;

    // Instruction field (required for LlmAgent)
    if (agentClass === 'LlmAgent') {
      const defaultInstruction = instruction || `You are a helpful AI agent named ${agentYamlName}.`;
      agentObj.instruction = defaultInstruction;
    } else if (instruction) {
      agentObj.instruction = instruction;
    }

    // Add explicit empty arrays for sub_agents and tools (matches Google ADK builder format)
    // This ensures consistent YAML structure and avoids ADK compatibility issues
    agentObj.sub_agents = [];
    agentObj.tools = [];

    const yamlContent = YAML.stringify(agentObj);

    // Write the file
    if (USE_GCS && storage) {
      const bucket = storage.bucket(GCS_BUCKET);
      await bucket.file(`${agentName}/${filename}`).save(yamlContent);
    } else {
      const agentDir = path.join(ADK_AGENTS_DIR, agentName);
      await fs.writeFile(path.join(agentDir, filename), yamlContent, 'utf-8');

      // Auto-generate __init__.py to make agent compatible with `adk eval`
      await generateInitPy(agentDir, agentName);
    }

    return NextResponse.json({
      success: true,
      filename,
      yaml: yamlContent,
    });
  } catch (error) {
    console.error('Error creating agent file:', error);
    return NextResponse.json(
      { error: 'Failed to create agent file' },
      { status: 500 }
    );
  }
}

// PATCH - Rename an agent YAML file
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: agentName } = await params;

  try {
    const body = await request.json();
    const { oldFilename, newFilename, yaml } = body;

    if (!oldFilename || !newFilename) {
      return NextResponse.json(
        { error: 'oldFilename and newFilename are required' },
        { status: 400 }
      );
    }

    // Don't allow renaming root_agent.yaml
    if (oldFilename === 'root_agent.yaml') {
      return NextResponse.json(
        { error: 'Cannot rename the root agent file' },
        { status: 400 }
      );
    }

    const agentDir = path.join(ADK_AGENTS_DIR, agentName);
    const oldFilePath = path.join(agentDir, oldFilename);
    const newFilePath = path.join(agentDir, newFilename);

    // Security check
    if (!oldFilePath.startsWith(agentDir) || !newFilePath.startsWith(agentDir)) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    // Check if old file exists
    try {
      await fs.access(oldFilePath);
    } catch {
      return NextResponse.json(
        { error: `File not found: ${oldFilename}` },
        { status: 404 }
      );
    }

    // Check if new filename already exists (unless it's the same file)
    if (oldFilename !== newFilename) {
      try {
        await fs.access(newFilePath);
        return NextResponse.json(
          { error: `File already exists: ${newFilename}` },
          { status: 409 }
        );
      } catch {
        // File doesn't exist, which is what we want
      }
    }

    // If yaml content is provided, write it to the new file
    // Otherwise, rename the file by reading and writing
    if (yaml) {
      await fs.writeFile(newFilePath, yaml, 'utf-8');
    } else {
      const content = await fs.readFile(oldFilePath, 'utf-8');
      await fs.writeFile(newFilePath, content, 'utf-8');
    }

    // Delete the old file if it's different from the new one
    if (oldFilename !== newFilename) {
      await fs.unlink(oldFilePath);

      // Update config_path references in all parent YAML files
      await updateParentReferences(agentDir, oldFilename, newFilename);
    }

    // Regenerate __init__.py to ensure it's up to date
    await generateInitPy(agentDir, agentName);

    return NextResponse.json({
      success: true,
      oldFilename,
      newFilename,
    });
  } catch (error) {
    console.error('Error renaming agent file:', error);
    return NextResponse.json(
      { error: 'Failed to rename agent file' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an agent YAML file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: agentName } = await params;

  try {
    const reqUrl = new URL(request.url);
    const filename = reqUrl.searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { error: 'filename query parameter is required' },
        { status: 400 }
      );
    }

    // Don't allow deleting root_agent.yaml
    if (filename === 'root_agent.yaml') {
      return NextResponse.json(
        { error: 'Cannot delete the root agent file' },
        { status: 400 }
      );
    }

    const agentDir = path.join(ADK_AGENTS_DIR, agentName);
    const filePath = path.join(agentDir, filename);

    // Security check
    if (!filePath.startsWith(agentDir)) {
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
        { error: `File not found: ${filename}` },
        { status: 404 }
      );
    }

    await fs.unlink(filePath);

    return NextResponse.json({
      success: true,
      filename,
    });
  } catch (error) {
    console.error('Error deleting agent file:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent file' },
      { status: 500 }
    );
  }
}
