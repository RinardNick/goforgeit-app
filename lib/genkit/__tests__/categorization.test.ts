import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ai } from '../index';

// Import flow AFTER spying on ai
const generateSpy = vi.spyOn(ai, 'generate');

import { categorizeToolFlow } from '../categorization';

describe('Categorization Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return category and tags from AI response', async () => {
    const mockOutput = {
      category: 'Data',
      tags: ['sql', 'postgres'],
    };

    // Mock the generate response
    generateSpy.mockResolvedValue({
      output: () => mockOutput,
    } as any);

    const result = await categorizeToolFlow('def test_tool(): pass');

    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('expert software architect'),
        prompt: expect.stringContaining('test_tool'),
      })
    );
    expect(result).toEqual(mockOutput);
  });

  it('should handle errors gracefully', async () => {
    generateSpy.mockRejectedValue(new Error('AI error'));

    await expect(categorizeToolFlow('content')).rejects.toThrow('AI error');
  });
});