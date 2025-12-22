import { query, queryOne } from './client';
import { categorizeToolFlow } from '../genkit/categorization';
import { validateSSEServer } from '../mcp/client';

export type ToolType = 'CUSTOM' | 'MCP';
// ... (rest of imports and types)

export interface Tool {
  id: string;
  name: string;
  description?: string;
  type: ToolType;
  config: any;
  org_id: string;
  source_project_id?: string;
  category?: string;
  tags?: any; // JSONB comes back as any/object usually
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

export type CreateToolInput = {
  name: string;
  type: ToolType;
  description?: string;
  config: any;
  orgId: string;
  sourceProjectId?: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
};

export async function registerTool(input: CreateToolInput): Promise<Tool> {
  console.log('[registerTool] Starting registration for:', input.name);
  
  // MCP Validation & Tool Discovery
  if (input.type === 'MCP') {
    try {
      console.log('[registerTool] Validating MCP connection...');
      // Assuming SSE for now as per UI default, but we should probably respect input.config.type if it exists
      // The UI sends { url: ... } for MCP
      const validation = await validateSSEServer({
        type: 'sse',
        url: input.config.url
      });

      if (validation.status === 'connected') {
        console.log('[registerTool] MCP connected. Found tools:', validation.tools.length);
        // Enrich config with discovered tools
        input.config.tools = validation.tools;
      } else {
        console.warn('[registerTool] MCP validation failed:', validation.errorMessage);
        throw new Error(`MCP Connection Failed: ${validation.errorMessage}`);
      }
    } catch (error) {
      console.error('[registerTool] MCP Validation Error:', error);
      throw error; // Re-throw to block registration if invalid
    }
  }

  let category = input.category;
  let tags = input.tags;

  // Auto-categorize if not provided
  if (!category || !tags || tags.length === 0) {
    try {
      console.log('[registerTool] Attempting AI categorization...');
      // Determine content to analyze
      let content = '';
      if (input.type === 'CUSTOM') {
        content = input.config.code || input.config.path || input.name;
      } else {
        // For MCP, use the discovered tools list if available, otherwise URL
        const toolsDesc = input.config.tools 
          ? input.config.tools.map((t: any) => `${t.name}: ${t.description}`).join('\n')
          : '';
        content = `MCP Server: ${input.config.url}\nTools:\n${toolsDesc}`;
      }

      const result = await categorizeToolFlow(content);
      console.log('[registerTool] AI Result:', result);
      category = category || result.category;
      tags = (tags && tags.length > 0) ? tags : result.tags;
    } catch (error) {
      console.warn('Auto-categorization failed during registration:', error);
    }
  }

  const sql = `
    INSERT INTO public.tool_registry 
    (name, type, description, config, org_id, source_project_id, category, tags, is_public)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;
  
  const params = [
    input.name,
    input.type,
    input.description,
    input.config,
    input.orgId,
    input.sourceProjectId,
    category,
    JSON.stringify(tags || []),
    input.isPublic || false
  ];

  console.log('[registerTool] Executing SQL insert...');
  const result = await queryOne<Tool>(sql, params);
  
  if (!result) {
    console.error('[registerTool] Insert returned null');
    throw new Error('Failed to register tool');
  }
  
  console.log('[registerTool] Successfully registered tool:', result.id);
  return result;
}

export async function listTools(orgId: string): Promise<Tool[]> {
  const sql = `
    SELECT * FROM public.tool_registry 
    WHERE org_id = $1 
    ORDER BY created_at DESC;
  `;
  return query<Tool>(sql, [orgId]);
}

export async function getTool(id: string): Promise<Tool | null> {
  const sql = `SELECT * FROM public.tool_registry WHERE id = $1;`;
  return queryOne<Tool>(sql, [id]);
}

export async function updateTool(id: string, updates: Partial<CreateToolInput>): Promise<Tool | null> {
  // Construct dynamic update query
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (updates.name) { fields.push(`name = $${idx++}`); values.push(updates.name); }
  if (updates.description) { fields.push(`description = $${idx++}`); values.push(updates.description); }
  if (updates.category) { fields.push(`category = $${idx++}`); values.push(updates.category); }
  if (updates.tags) { fields.push(`tags = $${idx++}`); values.push(JSON.stringify(updates.tags)); }
  if (updates.config) { fields.push(`config = $${idx++}`); values.push(updates.config); }
  if (updates.isPublic !== undefined) { fields.push(`is_public = $${idx++}`); values.push(updates.isPublic); }

  if (fields.length === 0) return getTool(id);

  fields.push(`updated_at = NOW()`);
  values.push(id); // ID is the last param

  const sql = `
    UPDATE public.tool_registry 
    SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING *;
  `;

  return queryOne<Tool>(sql, values);
}

export async function deleteTool(id: string): Promise<void> {
  await query('DELETE FROM public.tool_registry WHERE id = $1', [id]);
}
