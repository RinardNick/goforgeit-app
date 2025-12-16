
import { test, expect } from '@playwright/test';
import http from 'http';

test.describe('MCP Agents Endpoint', () => {
  test('GET /api/mcp/agents should establish SSE connection', async () => {
    // We use native http to avoid Playwright buffering the infinite stream
    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const req = http.get('http://localhost:3025/api/mcp/agents', (res) => {
        resolve(res);
      });
      req.on('error', reject);
    });
    
    // Should return 200 OK
    expect(response.statusCode).toBe(200);
    
    // Should be event-stream
    const contentType = response.headers['content-type'];
    expect(contentType).toContain('text/event-stream');
    
    // Cleanup
    response.destroy();
  });
});
