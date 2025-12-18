export interface ModelPricing {
  id: string;
  name: string;
  provider: 'google' | 'openai' | 'anthropic' | 'other';
  inputPrice: number; // Per 1M tokens
  outputPrice: number; // Per 1M tokens
  description?: string;
}

// Pricing per 1 Million tokens (approximate/placeholder for future models)
export const PRICING_TABLE: ModelPricing[] = [
  // --- Google ---
  { 
    id: 'gemini-2.0-flash-exp', 
    name: 'Gemini 2.0 Flash (Exp)', 
    provider: 'google', 
    inputPrice: 0.10, 
    outputPrice: 0.40,
    description: 'Fast, multimodal, experimental' 
  },
  { 
    id: 'gemini-2.5-flash', 
    name: 'Gemini 2.5 Flash', 
    provider: 'google', 
    inputPrice: 0.075, 
    outputPrice: 0.30,
    description: 'Next-gen flash model' 
  },
  { 
    id: 'gemini-1.5-flash', 
    name: 'Gemini 1.5 Flash', 
    provider: 'google', 
    inputPrice: 0.075, 
    outputPrice: 0.30 
  },
  { 
    id: 'gemini-1.5-pro', 
    name: 'Gemini 1.5 Pro', 
    provider: 'google', 
    inputPrice: 3.50, 
    outputPrice: 10.50 
  },
  // Future/Preview
  { 
    id: 'gemini-3.0-pro-preview', 
    name: 'Gemini 3.0 Pro (Preview)', 
    provider: 'google', 
    inputPrice: 5.00, 
    outputPrice: 15.00,
    description: 'Future flagship model' 
  },
  { 
    id: 'gemini-3.0-flash-preview', 
    name: 'Gemini 3.0 Flash (Preview)', 
    provider: 'google', 
    inputPrice: 0.15, 
    outputPrice: 0.60 
  },

  // --- OpenAI ---
  { 
    id: 'gpt-4o', 
    name: 'GPT-4o', 
    provider: 'openai', 
    inputPrice: 2.50, 
    outputPrice: 10.00 
  },
  { 
    id: 'gpt-5.2', 
    name: 'GPT-5.2 (Preview)', 
    provider: 'openai', 
    inputPrice: 20.00, 
    outputPrice: 60.00,
    description: 'Hypothetical future reasoning model' 
  },
  { 
    id: 'gpt-codex', 
    name: 'GPT Codex', 
    provider: 'openai', 
    inputPrice: 2.00, 
    outputPrice: 6.00,
    description: 'Specialized code model' 
  },

  // --- Anthropic ---
  { 
    id: 'claude-3-5-sonnet', 
    name: 'Claude 3.5 Sonnet', 
    provider: 'anthropic', 
    inputPrice: 3.00, 
    outputPrice: 15.00 
  },
  { 
    id: 'claude-4.5-opus', 
    name: 'Claude 4.5 Opus', 
    provider: 'anthropic', 
    inputPrice: 15.00, 
    outputPrice: 75.00,
    description: 'Massive reasoning capacity' 
  },
];

export function getModelPricing(modelId: string): ModelPricing {
  if (!modelId) return PRICING_TABLE[0];
  
  // Exact match
  const exact = PRICING_TABLE.find(m => m.id === modelId);
  if (exact) return exact;

  // Prefix match (e.g. 'gemini-1.5-flash-001' -> 'gemini-1.5-flash')
  const prefix = PRICING_TABLE.find(m => modelId.startsWith(m.id));
  if (prefix) return prefix;

  // Default fallback (Flash pricing)
  return { 
    id: modelId, 
    name: modelId, 
    provider: 'other', 
    inputPrice: 0.10, 
    outputPrice: 0.30 
  };
}
