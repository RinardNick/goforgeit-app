import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuration
const SYSTEM_TOOLS_MCP_URL = process.env.SYSTEM_TOOLS_MCP_URL || 'http://localhost:3025/api/mcp/system-tools/sse';

const POTENTIAL_PATHS = [
  path.join(process.cwd(), 'adk-service', 'agents'),
  path.join(process.cwd(), 'agents')
];

async function getYamlFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const res = path.resolve(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await getYamlFiles(res)));
      } else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
        files.push(res);
      }
    }
    return files;
  } catch {
    return [];
  }
}

async function configureAgents() {
  console.log(`🔧 Configuring Agents...`);
  console.log(`   SYSTEM_TOOLS_MCP_URL: ${SYSTEM_TOOLS_MCP_URL}`);

  let totalUpdated = 0;

  for (const dir of POTENTIAL_PATHS) {
    const files = await getYamlFiles(dir);
    if (files.length > 0) {
      console.log(`   Found agents in: ${dir}`);
      for (const file of files) {
        let content = await fs.readFile(file, 'utf-8');
        
        if (content.includes('${SYSTEM_TOOLS_MCP_URL}')) {
          content = content.replace(/\$\{SYSTEM_TOOLS_MCP_URL\}/g, SYSTEM_TOOLS_MCP_URL);
          await fs.writeFile(file, content, 'utf-8');
          console.log(`   ✓ Configured ${path.basename(file)}`);
          totalUpdated++;
        }
      }
    }
  }

  if (totalUpdated === 0) {
    console.log('   ℹ️  No files needed configuration (or directory not found).');
  } else {
    console.log(`✅ Configuration complete. Updated ${totalUpdated} files.`);
  }
}

configureAgents();
