import fs from 'fs/promises';
import path from 'path';

const SHARED_TOOLS_DIR = 'lib/adk/shared/tools';

/**
 * Moves a tool file from an agent's directory to the shared tools library.
 * Handles duplicate filenames by appending a counter.
 *
 * @param sourcePath Absolute or relative path to the source file
 * @param orgId The organization ID (for future use/logging)
 * @returns The relative path to the new shared file
 */
export async function promoteToolToShared(sourcePath: string, orgId: string): Promise<string> {
  const fileName = path.basename(sourcePath);
  let destPath = path.join(SHARED_TOOLS_DIR, fileName);
  
  // Verify source exists
  try {
    await fs.access(sourcePath);
  } catch (error) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  // Ensure shared dir exists (should be created by build/setup, but good for safety)
  await fs.mkdir(SHARED_TOOLS_DIR, { recursive: true });

  // Handle name collisions
  let counter = 1;
  while (true) {
    try {
      await fs.access(destPath);
      // File exists, try next name
      const ext = path.extname(fileName);
      const name = path.basename(fileName, ext);
      destPath = path.join(SHARED_TOOLS_DIR, `${name}_${counter}${ext}`);
      counter++;
    } catch (e) {
      // File does not exist, safe to use
      break;
    }
  }

  // Copy the file
  await fs.copyFile(sourcePath, destPath);

  return destPath;
}
