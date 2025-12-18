import { createAgentTool } from '../lib/genkit/tools/builder-tools';

async function main() {
  const tool = createAgentTool();
  // @ts-ignore
  const action = tool.__action;
  console.log('Action Keys:', Object.keys(action));
  console.log('Action Name:', action.name);
  console.log('Action Description:', action.description);
  console.log('Input JSON Schema:', JSON.stringify(action.inputJsonSchema));
}

main().catch(console.error);
