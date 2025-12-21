import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('CreateToolModal Logic', () => {
  describe('Validation', () => {
    it('should require a description', () => {
      const description = '';
      const isValid = description.trim().length > 0;
      assert.strictEqual(isValid, false);
    });

    it('should accept a valid description', () => {
      const description = 'A tool to fetch stock prices';
      const isValid = description.trim().length > 0;
      assert.strictEqual(isValid, true);
    });
  });
});
