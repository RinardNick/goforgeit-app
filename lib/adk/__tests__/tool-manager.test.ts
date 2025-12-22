import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promoteToolToShared } from '../tool-manager';
import fs from 'fs/promises';
import path from 'path';

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    mkdir: vi.fn(),
    copyFile: vi.fn(),
  },
}));

describe('Tool Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('promoteToolToShared', () => {
    it('moves a tool file to the shared directory', async () => {
      const sourcePath = 'adk-service/agents/test-agent/tools/test_tool.py';
      const fileName = 'test_tool.py';
      
      // Mock file checks
      (fs.access as any).mockImplementation(async (p: string) => {
        if (p === sourcePath) return undefined; // Source exists
        throw { code: 'ENOENT' }; // Dest doesn't exist
      });
      
      // Mock copy
      (fs.copyFile as any).mockResolvedValue(undefined);
      
      const sharedPath = await promoteToolToShared(sourcePath, 'org-123');
      
      expect(fs.copyFile).toHaveBeenCalledWith(
        sourcePath,
        expect.stringContaining(`lib/adk/shared/tools/${fileName}`)
      );
      expect(sharedPath).toContain(`lib/adk/shared/tools/${fileName}`);
    });

    it('handles duplicate filenames by renaming', async () => {
      const sourcePath = 'agent/tools/duplicate.py';
      
      // Mock behavior:
      // 1. Check source -> exists
      // 2. Check dest (duplicate.py) -> exists (collision)
      // 3. Check dest (duplicate_1.py) -> does not exist (safe)
      (fs.access as any).mockImplementation(async (p: string) => {
         if (p === sourcePath) return undefined;
         if (p.endsWith('duplicate.py')) return undefined; // Exists
         throw { code: 'ENOENT' }; // Does not exist
      });

      const sharedPath = await promoteToolToShared(sourcePath, 'org-123');
      
      // Should have tried to save as duplicate_1.py
      expect(fs.copyFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/duplicate_1\.py$/)
      );
    });
  });
});
