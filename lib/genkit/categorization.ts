import { z } from 'zod';
import { ai } from './index';

export const CategorizationSchema = z.object({
  category: z.string().describe('Broad category for the tool'),
  tags: z.array(z.string()).describe('Specific keywords/tags for the tool'),
});

/**
 * AI Flow to categorize a tool based on its content or configuration.
 */
export const categorizeToolFlow = ai.defineFlow(
  {
    name: 'categorizeTool',
    inputSchema: z.string(),
    outputSchema: CategorizationSchema,
  },
  async (toolContent) => {
    const response = await ai.generate({
      system: 'You are an expert software architect. Analyze the tool and provide a category and tags.',
      prompt: `Analyze this tool and respond with a JSON object containing "category" and "tags":\n\n${toolContent}`,
      output: { schema: CategorizationSchema },
    });

    return response.output();
  }
);
