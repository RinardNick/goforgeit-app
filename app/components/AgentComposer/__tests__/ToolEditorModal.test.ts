import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('ToolEditorModal Logic', () => {
  describe('Language Detection', () => {
    const getLanguage = (filename: string) => {
      return filename.endsWith('.py') ? 'python' : 'yaml';
    };

    it('should detect python for .py files', () => {
      assert.strictEqual(getLanguage('tools/my_tool.py'), 'python');
    });

    it('should detect yaml for .yaml files', () => {
      assert.strictEqual(getLanguage('root_agent.yaml'), 'yaml');
    });

    it('should default to yaml for other files', () => {
      assert.strictEqual(getLanguage('README.md'), 'yaml');
    });
  });
});
