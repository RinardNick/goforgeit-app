
import { test, expect } from '@playwright/test';
import http from 'http';

test.describe('MCP Agents Endpoint', () => {
  test('GET /api/mcp/agents should establish SSE connection', async () => {
    // We use native http to avoid Playwright buffering the infinite stream
    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 3025,
        path: '/api/mcp/agents',
        method: 'GET',
        headers: {
          'X-API-Key': 'test-api-key'
        }
      };
      const req = http.request(options, (res) => {
        resolve(res);
      });
      req.end();
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
