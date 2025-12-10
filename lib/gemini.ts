/**
 * Shared Gemini API Client
 *
 * Single source of truth for Gemini API initialization.
 * All Gemini API calls should go through this module.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy-initialized Gemini client
let genAIClient: GoogleGenerativeAI | null = null;

/**
 * Get the shared Gemini API client.
 * Throws an error if GEMINI_API_KEY is not configured.
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable not configured');
    }
    genAIClient = new GoogleGenerativeAI(apiKey);
  }
  return genAIClient;
}

/**
 * Check if Gemini API is configured.
 * Returns false if GEMINI_API_KEY is not set.
 */
export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
