import { test, expect } from '@playwright/test';
import http from 'http';

/**
 * MCP System Tools SSE Endpoint Tests
 *
 * These tests verify that the MCP SSE transport works correctly for the
 * builder_agent and forge_agent which use MCPToolset to connect to
 * /api/mcp/system-tools/sse
 *
 * The issue being tested: SSE connections were closing immediately after
 * handshake, causing "Connection closed" errors in ADK agents.
 */
test.describe('MCP System Tools SSE Endpoint', () => {

  test('GET /api/mcp/system-tools/sse should establish SSE connection', async () => {
    // We use native http to avoid Playwright buffering the infinite stream
    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 3025,
        path: '/api/mcp/system-tools/sse',
        method: 'GET',
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

  test('SSE connection should send endpoint event with POST URL', async () => {
    // This test verifies the critical handshake - the server must send
    // an "endpoint" event that tells clients where to POST messages
    const endpointReceived = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for endpoint event')), 10000);

      const options = {
        hostname: 'localhost',
        port: 3025,
        path: '/api/mcp/system-tools/sse',
        method: 'GET',
      };

      const req = http.request(options, (res) => {
        let buffer = '';

        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();

          // Parse SSE events
          const lines = buffer.split('\n');
          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i];
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              // Check if this is an endpoint URL
              if (data.includes('/api/mcp/system-tools/messages')) {
                clearTimeout(timeout);
                res.destroy();
                resolve(data);
              }
            }
          }
        });

        res.on('error', reject);
      });

      req.end();
      req.on('error', reject);
    });

    // The endpoint should be an absolute URL to the messages endpoint
    expect(endpointReceived).toContain('http://localhost:3025/api/mcp/system-tools/messages');
    expect(endpointReceived).toContain('sessionId=');
  });

  test('SSE connection should remain open for at least 5 seconds', async () => {
    // This test verifies the connection doesn't immediately close
    // The issue was: connection opens, handshake completes, then immediately closes
    const connectionDuration = await new Promise<number>((resolve, reject) => {
      const startTime = Date.now();
      let endpointReceived = false;

      const options = {
        hostname: 'localhost',
        port: 3025,
        path: '/api/mcp/system-tools/sse',
        method: 'GET',
      };

      const req = http.request(options, (res) => {
        res.on('data', (chunk: Buffer) => {
          const data = chunk.toString();
          if (data.includes('endpoint') && data.includes('/api/mcp/system-tools/messages')) {
            endpointReceived = true;
          }
        });

        res.on('close', () => {
          const duration = Date.now() - startTime;
          if (endpointReceived) {
            resolve(duration);
          } else {
            reject(new Error('Connection closed before endpoint event received'));
          }
        });

        res.on('error', (err) => {
          const duration = Date.now() - startTime;
          resolve(duration); // Still report duration on error
        });
      });

      req.end();
      req.on('error', reject);

      // After 5 seconds, if still connected, that's success - close it ourselves
      setTimeout(() => {
        if (endpointReceived) {
          req.destroy();
          resolve(Date.now() - startTime);
        }
      }, 5000);
    });

    // Connection should stay open for at least 5 seconds after handshake
    // If it closes immediately (< 1 second), that's the bug we're testing for
    expect(connectionDuration).toBeGreaterThanOrEqual(5000);
  });

  test('can POST a JSON-RPC initialize message to the messages endpoint', async () => {
    // First establish SSE connection and get the endpoint URL
    // IMPORTANT: Keep the SSE connection open while posting messages
    let sseRequest: http.ClientRequest | null = null;

    const { sessionId, messagesUrl } = await new Promise<{ sessionId: string; messagesUrl: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for endpoint')), 10000);

      const options = {
        hostname: 'localhost',
        port: 3025,
        path: '/api/mcp/system-tools/sse',
        method: 'GET',
      };

      sseRequest = http.request(options, (res) => {
        let buffer = '';

        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && line.includes('/api/mcp/system-tools/messages')) {
              const url = line.slice(6).trim();
              const sessionIdMatch = url.match(/sessionId=([^&]+)/);
              if (sessionIdMatch) {
                clearTimeout(timeout);
                // DON'T close the connection - keep it open for the session
                resolve({
                  sessionId: sessionIdMatch[1],
                  messagesUrl: url,
                });
              }
            }
          }
        });
      });

      sseRequest.end();
      sseRequest.on('error', reject);
    });

    try {
      // Small delay to ensure session is registered
      await new Promise(resolve => setTimeout(resolve, 100));

      // Now POST a JSON-RPC initialize message
      const initializeMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      const postResponse = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
        const postData = JSON.stringify(initializeMessage);
        const url = new URL(messagesUrl);

        const options = {
          hostname: url.hostname,
          port: url.port,
          path: `${url.pathname}${url.search}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        };

        const req = http.request(options, (res) => {
          let body = '';
          res.on('data', (chunk: Buffer) => {
            body += chunk.toString();
          });
          res.on('end', () => {
            resolve({ statusCode: res.statusCode || 0, body });
          });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      // Should return 200 OK or 202 Accepted (message queued for processing)
      expect([200, 202]).toContain(postResponse.statusCode);
    } finally {
      // Clean up: close the SSE connection
      if (sseRequest) {
        sseRequest.destroy();
      }
    }
  });

  test('full MCP session flow: connect, initialize, list tools', async () => {
    // This is the full flow that ADK uses when connecting to an MCP server

    // Step 1: Establish SSE connection
    let sseRequest: http.ClientRequest | null = null;
    const sessionInfo = await new Promise<{ sessionId: string; messagesUrl: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for endpoint')), 10000);

      sseRequest = http.request({
        hostname: 'localhost',
        port: 3025,
        path: '/api/mcp/system-tools/sse',
        method: 'GET',
      }, (res) => {
        let buffer = '';
        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && line.includes('/api/mcp/system-tools/messages')) {
              const url = line.slice(6).trim();
              const sessionIdMatch = url.match(/sessionId=([^&]+)/);
              if (sessionIdMatch) {
                clearTimeout(timeout);
                resolve({
                  sessionId: sessionIdMatch[1],
                  messagesUrl: url,
                });
              }
            }
          }
        });
      });

      sseRequest.end();
      sseRequest.on('error', reject);
    });

    const postMessage = async (message: object): Promise<{ statusCode: number; body: string }> => {
      const postData = JSON.stringify(message);
      const url = new URL(sessionInfo.messagesUrl);

      return new Promise((resolve, reject) => {
        const req = http.request({
          hostname: url.hostname,
          port: url.port,
          path: `${url.pathname}${url.search}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        }, (res) => {
          let body = '';
          res.on('data', (chunk: Buffer) => body += chunk.toString());
          res.on('end', () => resolve({ statusCode: res.statusCode || 0, body }));
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
      });
    };

    // Small delay to ensure session is registered
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 2: Send initialize request
    const initResponse = await postMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });
    expect([200, 202]).toContain(initResponse.statusCode);

    // Step 3: Send initialized notification
    const initializedResponse = await postMessage({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect([200, 202]).toContain(initializedResponse.statusCode);

    // Step 4: List available tools
    const toolsResponse = await postMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });
    expect([200, 202]).toContain(toolsResponse.statusCode);

    // Cleanup
    if (sseRequest) {
      sseRequest.destroy();
    }
  });
});
