import { query, queryOne } from './client';

export type ToolType = 'CUSTOM' | 'MCP';

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
  const sql = `
    INSERT INTO tool_registry 
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
    input.category,
    JSON.stringify(input.tags || []),
    input.isPublic || false
  ];

  const result = await queryOne<Tool>(sql, params);
  if (!result) throw new Error('Failed to register tool');
  return result;
}

export async function listTools(orgId: string): Promise<Tool[]> {
  const sql = `
    SELECT * FROM tool_registry 
    WHERE org_id = $1 
    ORDER BY created_at DESC;
  `;
  return query<Tool>(sql, [orgId]);
}

export async function getTool(id: string): Promise<Tool | null> {
  const sql = `SELECT * FROM tool_registry WHERE id = $1;`;
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
    UPDATE tool_registry 
    SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING *;
  `;

  return queryOne<Tool>(sql, values);
}

export async function deleteTool(id: string): Promise<void> {
  await query('DELETE FROM tool_registry WHERE id = $1', [id]);
}
