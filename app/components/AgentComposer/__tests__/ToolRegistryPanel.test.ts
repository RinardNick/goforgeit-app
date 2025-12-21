import { describe, it } from 'node:test';
import assert from 'node:assert';

// Mocking the logic that would be used in ToolRegistryPanel
describe('ToolRegistryPanel Logic', () => {
  const mockFiles = [
    { filename: 'root_agent.yaml', yaml: 'name: root' },
    { filename: 'other_agent.yaml', yaml: 'name: other' },
    { filename: 'tools/get_weather.py', yaml: 'def get_weather(): pass' },
    { filename: 'tools/search.py', yaml: 'def search(): pass' },
    { filename: 'README.md', yaml: '# README' },
  ];

  describe('File Filtering', () => {
    it('should correctly identify python tools', () => {
      const pythonTools = mockFiles.filter(f => f.filename.startsWith('tools/') && f.filename.endsWith('.py'));
      assert.strictEqual(pythonTools.length, 2);
      assert.strictEqual(pythonTools[0].filename, 'tools/get_weather.py');
      assert.strictEqual(pythonTools[1].filename, 'tools/search.py');
    });

    it('should correctly identify agent tools (excluding root)', () => {
      const agentTools = mockFiles.filter(f => f.filename !== 'root_agent.yaml' && f.filename.endsWith('.yaml'));
      assert.strictEqual(agentTools.length, 1);
      assert.strictEqual(agentTools[0].filename, 'other_agent.yaml');
    });
  });

  describe('Search Filtering', () => {
    const pythonTools = mockFiles.filter(f => f.filename.startsWith('tools/') && f.filename.endsWith('.py'));
    
    it('should filter tools by search query', () => {
      const searchQuery = 'weather';
      const filtered = pythonTools.filter(t => 
        t.filename.toLowerCase().includes(searchQuery.toLowerCase())
      );
      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].filename, 'tools/get_weather.py');
    });

    it('should be case-insensitive', () => {
      const searchQuery = 'WEATHER';
      const filtered = pythonTools.filter(t => 
        t.filename.toLowerCase().includes(searchQuery.toLowerCase())
      );
      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].filename, 'tools/get_weather.py');
    });

    it('should return all tools on empty search', () => {
      const searchQuery = '';
      const filtered = pythonTools.filter(t => 
        t.filename.toLowerCase().includes(searchQuery.toLowerCase())
      );
      assert.strictEqual(filtered.length, 2);
    });
  });
});
