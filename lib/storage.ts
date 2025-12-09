/**
 * Storage abstraction layer for GCS (production) and filesystem (local)
 */

import { Storage as GCSStorage } from '@google-cloud/storage';
import { promises as fs } from 'fs';
import path from 'path';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');
const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'goforgeit-adk-agents';
const ADK_BACKEND_URL = process.env.ADK_BACKEND_URL || 'http://127.0.0.1:8000';
export const USE_GCS = process.env.NODE_ENV === 'production';

// Lazy-initialized GCS client
let gcsClient: GCSStorage | null = null;
function getGCS(): GCSStorage {
  if (!gcsClient) {
    gcsClient = new GCSStorage();
  }
  return gcsClient;
}

/**
 * Read a file from agent directory (GCS or filesystem)
 */
export async function readAgentFile(agentName: string, filename: string): Promise<string | null> {
  if (USE_GCS) {
    const bucket = getGCS().bucket(GCS_BUCKET);
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

/**
 * Write a file to agent directory (GCS or filesystem)
 */
export async function writeAgentFile(
  agentName: string,
  filename: string,
  content: string,
  contentType: string = 'text/yaml'
): Promise<void> {
  if (USE_GCS) {
    const bucket = getGCS().bucket(GCS_BUCKET);
    await bucket.file(`${agentName}/${filename}`).save(content, { contentType });
  } else {
    const filePath = path.join(ADK_AGENTS_DIR, agentName, filename);
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }
}

/**
 * Delete a file from agent directory (GCS or filesystem)
 */
export async function deleteAgentFile(agentName: string, filename: string): Promise<boolean> {
  if (USE_GCS) {
    const bucket = getGCS().bucket(GCS_BUCKET);
    const file = bucket.file(`${agentName}/${filename}`);
    const [exists] = await file.exists();
    if (!exists) return false;
    await file.delete();
    return true;
  } else {
    const filePath = path.join(ADK_AGENTS_DIR, agentName, filename);
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Check if a file exists in agent directory
 */
export async function agentFileExists(agentName: string, filename: string): Promise<boolean> {
  if (USE_GCS) {
    const bucket = getGCS().bucket(GCS_BUCKET);
    const [exists] = await bucket.file(`${agentName}/${filename}`).exists();
    return exists;
  } else {
    const filePath = path.join(ADK_AGENTS_DIR, agentName, filename);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * List files in an agent subdirectory (e.g., evaluations)
 */
export async function listAgentFiles(agentName: string, subdir?: string): Promise<string[]> {
  const prefix = subdir ? `${agentName}/${subdir}/` : `${agentName}/`;
  
  if (USE_GCS) {
    const bucket = getGCS().bucket(GCS_BUCKET);
    const [files] = await bucket.getFiles({ prefix });
    return files
      .map(f => path.basename(f.name))
      .filter(name => name.length > 0); // Filter out directory markers
  } else {
    const dirPath = path.join(ADK_AGENTS_DIR, agentName, subdir || '');
    try {
      return await fs.readdir(dirPath);
    } catch {
      return [];
    }
  }
}

/**
 * Delete all files in an agent directory (for deleting entire agent)
 */
export async function deleteAgentDirectory(agentName: string): Promise<boolean> {
  if (USE_GCS) {
    const bucket = getGCS().bucket(GCS_BUCKET);
    const [files] = await bucket.getFiles({ prefix: `${agentName}/` });
    if (files.length === 0) return false;
    await Promise.all(files.map(file => file.delete()));
    return true;
  } else {
    const dirPath = path.join(ADK_AGENTS_DIR, agentName);
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Verify agent exists (via ADK backend in production, filesystem locally)
 */
export async function verifyAgentExists(agentName: string): Promise<boolean> {
  if (USE_GCS) {
    try {
      const response = await fetch(`${ADK_BACKEND_URL}/builder/app/${agentName}`);
      return response.ok;
    } catch {
      return false;
    }
  } else {
    const agentDir = path.join(ADK_AGENTS_DIR, agentName);
    try {
      await fs.access(agentDir);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Ensure evaluations directory exists for an agent
 */
export async function ensureEvalsDir(agentName: string): Promise<void> {
  if (!USE_GCS) {
    const evalsDir = path.join(ADK_AGENTS_DIR, agentName, 'evaluations');
    await fs.mkdir(evalsDir, { recursive: true });
  }
  // GCS doesn't need explicit directory creation
}
