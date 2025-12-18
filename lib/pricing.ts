export interface ModelPricing {
  id: string;
  name: string;
  displayLabel: string;
  provider: 'google' | 'openai' | 'anthropic' | 'other';
  inputPrice: number; // Per 1M tokens
  outputPrice: number; // Per 1M tokens
  description?: string;
  isAvailable: boolean;
}

// Pricing per 1 Million tokens (approximate/placeholder for future models)
export const PRICING_TABLE: ModelPricing[] = [
  // --- Google Gemini ---
  { 
    id: 'gemini-3.0-pro-preview', 
    name: 'Gemini 3.0 Pro (Preview)', 
    displayLabel: 'Gemini 3.0 Pro (Preview)',
    provider: 'google', 
    inputPrice: 5.00, 
    outputPrice: 15.00,
    description: 'Future flagship model with massive context',
    isAvailable: true 
  },
  { 
    id: 'gemini-3.0-flash-preview', 
    name: 'Gemini 3.0 Flash (Preview)', 
    displayLabel: 'Gemini 3.0 Flash (Preview)',
    provider: 'google', 
    inputPrice: 0.15, 
    outputPrice: 0.60,
    description: 'Future speed-optimized model',
    isAvailable: true 
  },
  { 
    id: 'gemini-2.5-flash', 
    name: 'Gemini 2.5 Flash', 
    displayLabel: 'Gemini 2.5 Flash (Balanced)',
    provider: 'google', 
    inputPrice: 0.075, 
    outputPrice: 0.30,
    description: 'Next-gen flash model',
    isAvailable: true 
  },
  { 
    id: 'gemini-2.0-flash-exp', 
    name: 'Gemini 2.0 Flash (Exp)', 
    displayLabel: 'Gemini 2.0 Flash (Fastest)',
    provider: 'google', 
    inputPrice: 0.10, 
    outputPrice: 0.40,
    description: 'Fast, multimodal, experimental',
    isAvailable: true 
  },
  { 
    id: 'gemini-1.5-pro', 
    name: 'Gemini 1.5 Pro', 
    displayLabel: 'Gemini 1.5 Pro (Reliable)',
    provider: 'google', 
    inputPrice: 3.50, 
    outputPrice: 10.50,
    isAvailable: true 
  },
  { 
    id: 'gemini-1.5-flash', 
    name: 'Gemini 1.5 Flash', 
    displayLabel: 'Gemini 1.5 Flash (Legacy)',
    provider: 'google', 
    inputPrice: 0.075, 
    outputPrice: 0.30,
    isAvailable: true 
  },

  // --- OpenAI GPT ---
  { 
    id: 'gpt-5.2', 
    name: 'GPT-5.2 (Preview)', 
    displayLabel: 'GPT-5.2 (Early Access)',
    provider: 'openai', 
    inputPrice: 20.00, 
    outputPrice: 60.00,
    description: 'Hypothetical future reasoning model',
    isAvailable: true 
  },
  { 
    id: 'gpt-4o', 
    name: 'GPT-4o', 
    displayLabel: 'GPT-4o (Omni)',
    provider: 'openai', 
    inputPrice: 2.50, 
    outputPrice: 10.00,
    isAvailable: true 
  },
  { 
    id: 'gpt-codex', 
    name: 'GPT Codex', 
    displayLabel: 'GPT Codex (Specialized)',
    provider: 'openai', 
    inputPrice: 2.00, 
    outputPrice: 6.00,
    description: 'Specialized code generation model',
    isAvailable: true 
  },

  // --- Anthropic Claude ---
  { 
    id: 'claude-4.5-opus', 
    name: 'Claude 4.5 Opus', 
    displayLabel: 'Claude 4.5 Opus (God Mode)',
    provider: 'anthropic', 
    inputPrice: 15.00, 
    outputPrice: 75.00,
    description: 'Massive reasoning capacity',
    isAvailable: true 
  },
  { 
    id: 'claude-3-5-sonnet', 
    name: 'Claude 3.5 Sonnet', 
    displayLabel: 'Claude 3.5 Sonnet (Coding)',
    provider: 'anthropic', 
    inputPrice: 3.00, 
    outputPrice: 15.00,
    isAvailable: true 
  },
];

export function getAvailableModels() {
  return PRICING_TABLE.filter(m => m.isAvailable);
}

export function getModelPricing(modelId: string): ModelPricing {
  if (!modelId) return PRICING_TABLE.find(m => m.id === 'gemini-2.0-flash-exp') || PRICING_TABLE[0];
  
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
    displayLabel: modelId,
    provider: 'other', 
    inputPrice: 0.10, 
    outputPrice: 0.30,
    isAvailable: true
  };
}

