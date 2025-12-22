import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from '../client';

// Mock categorizeToolFlow
vi.mock('../../genkit/categorization', () => ({
  categorizeToolFlow: vi.fn().mockResolvedValue({ category: 'AI', tags: ['auto'] }),
}));

import * as toolRegistry from '../tool-registry';
import { categorizeToolFlow } from '../../genkit/categorization';

// Mock the db client
vi.mock('../client', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

describe('Tool Registry DB Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerTool', () => {
    it('creates a new tool entry', async () => {
      const toolData = {
        name: 'Test Tool',
        type: 'CUSTOM' as const,
        description: 'A test tool',
        config: { path: 'libs/tools/test.py' },
        orgId: 'org-123',
        sourceProjectId: 'proj-456',
        category: 'Utility',
        tags: ['test', 'utils']
      };

      const mockResult = {
        id: 'tool-789',
        ...toolData,
        created_at: new Date(),
        updated_at: new Date()
      };

      (db.queryOne as any).mockResolvedValue(mockResult);

      const result = await toolRegistry.registerTool(toolData);

      expect(db.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tool_registry'),
        expect.arrayContaining(['Test Tool', 'CUSTOM'])
      );
      expect(result).toEqual(mockResult);
    });

    it('auto-categorizes if metadata is missing', async () => {
      const toolData = {
        name: 'Empty Metadata Tool',
        type: 'CUSTOM' as const,
        config: { path: 'test.py' },
        orgId: 'org-123',
      };

      (db.queryOne as any).mockResolvedValue({ id: 'new-id', ...toolData });

      await toolRegistry.registerTool(toolData);

      expect(categorizeToolFlow).toHaveBeenCalled();
    });
  });

  describe('listTools', () => {
    it('returns a list of tools for an organization', async () => {
      const mockTools = [
        { id: '1', name: 'Tool A', org_id: 'org-123' },
        { id: '2', name: 'Tool B', org_id: 'org-123' }
      ];

      (db.query as any).mockResolvedValue(mockTools);

      const result = await toolRegistry.listTools('org-123');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM tool_registry'),
        ['org-123']
      );
      expect(result).toEqual(mockTools);
    });
  });

  describe('getTool', () => {
    it('returns a specific tool', async () => {
      const mockTool = { id: 'tool-789', name: 'Test Tool' };
      (db.queryOne as any).mockResolvedValue(mockTool);

      const result = await toolRegistry.getTool('tool-789');

      expect(db.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM tool_registry WHERE id = $1'),
        ['tool-789']
      );
      expect(result).toEqual(mockTool);
    });
  });

  describe('updateTool', () => {
    it('updates tool metadata', async () => {
      const updates = { description: 'Updated desc' };
      const mockUpdated = { id: 'tool-789', ...updates };
      (db.queryOne as any).mockResolvedValue(mockUpdated);

      const result = await toolRegistry.updateTool('tool-789', updates);

      expect(db.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tool_registry'),
        expect.any(Array)
      );
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('deleteTool', () => {
    it('deletes a tool', async () => {
      (db.query as any).mockResolvedValue([]);

      await toolRegistry.deleteTool('tool-789');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM tool_registry WHERE id = $1'),
        ['tool-789']
      );
    });
  });
});
