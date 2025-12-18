import { genkit } from 'genkit';

// Initialize Genkit with no plugins for now (tools don't strictly need plugins unless they use models)
export const ai = genkit({
  plugins: [],
});
