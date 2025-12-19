import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export class WebSSETransport implements Transport {
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private encoder = new TextEncoder();
  public sessionId: string;
  private baseUrl: string;
  private started = false;  // Track if we've already sent the endpoint event
  public onmessage?: (message: JSONRPCMessage) => void;
  public onclose?: () => void;
  public onerror?: (error: Error) => void;

  constructor(writer: WritableStreamDefaultWriter<Uint8Array>, sessionId: string, baseUrl: string) {
    this.writer = writer;
    this.sessionId = sessionId;
    this.baseUrl = baseUrl;
  }

  async start() {
    // Only send endpoint event once - MCP SDK client throws error if received twice
    if (this.started) {
      console.log(`[WebSSETransport] start() called again for ${this.sessionId} - ignoring (already started)`);
      return;
    }
    this.started = true;

    console.log(`[WebSSETransport] Starting session ${this.sessionId} with base ${this.baseUrl}`);
    // Send absolute endpoint URL indicating where to POST messages
    // This is critical for clients like ADK that may not resolve relative paths correctly
    const endpoint = `${this.baseUrl}/api/mcp/system-tools/messages?sessionId=${this.sessionId}`;
    const event = `event: endpoint\ndata: ${endpoint}\n\n`;
    await this.writer.write(this.encoder.encode(event));
  }

  async send(message: JSONRPCMessage) {
    console.log(`[WebSSETransport] Sending message to ${this.sessionId}`);
    const data = JSON.stringify(message);
    const event = `event: message\ndata: ${data}\n\n`;
    await this.writer.write(this.encoder.encode(event));
  }

  async close() {
    console.log(`[WebSSETransport] Closing session ${this.sessionId}`);
    try {
      await this.writer.close();
    } catch {
      // Ignore if already closed
    }
    this.onclose?.();
  }
  
  async handleMessage(message: JSONRPCMessage) {
    this.onmessage?.(message);
  }
}