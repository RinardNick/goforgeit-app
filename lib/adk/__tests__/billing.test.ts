import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateBilling } from '../billing';

describe('Billing Logic', () => {
  it('should return null if no usage metadata is present', async () => {
    const response = new Response(JSON.stringify({ content: 'hello' }));
    const result = await calculateBilling(response.clone());
    assert.strictEqual(result, null);
  });

  it('should extract token count from usageMetadata (Object)', async () => {
    const data = {
      usageMetadata: {
        totalTokenCount: 1500,
        promptTokenCount: 1000,
        candidatesTokenCount: 500
      },
      modelVersion: 'gemini-1.5'
    };
    const response = new Response(JSON.stringify(data));
    const result = await calculateBilling(response.clone());
    
    assert.notStrictEqual(result, null);
    assert.strictEqual(result?.tokens, 1500);
    assert.strictEqual(result?.promptTokens, 1000);
    assert.strictEqual(result?.completionTokens, 500);
  });

  it('should extract token count from usageMetadata (Array)', async () => {
    const data = [
      {
        modelVersion: 'gemini-2.5-flash',
        content: { role: 'model', parts: [{ text: 'Hello' }] }
      },
      {
        usageMetadata: {
          totalTokenCount: 200,
          promptTokenCount: 150,
          candidatesTokenCount: 50
        }
      }
    ];
    const response = new Response(JSON.stringify(data));
    const result = await calculateBilling(response.clone());
    
    assert.notStrictEqual(result, null);
    assert.strictEqual(result?.tokens, 200);
    assert.strictEqual(result?.promptTokens, 150);
    assert.strictEqual(result?.completionTokens, 50);
  });

  it('should handle SSE stream format', async () => {
    const sseData = `data: {"content": {"parts": [{"text": "Hello"}]}}\n\ndata: {"usageMetadata": {"totalTokenCount": 2000, "promptTokenCount": 1000, "candidatesTokenCount": 1000}}\n\n`;
    const response = new Response(sseData);
    const result = await calculateBilling(response.clone());

    assert.notStrictEqual(result, null);
    assert.strictEqual(result?.tokens, 2000);
    assert.strictEqual(result?.promptTokens, 1000);
    assert.strictEqual(result?.completionTokens, 1000);
  });
});