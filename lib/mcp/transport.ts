import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export class WebSSETransport implements Transport {
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private encoder = new TextEncoder();
  public sessionId: string;
  public onmessage?: (message: JSONRPCMessage) => void;
  public onclose?: () => void;
  public onerror?: (error: Error) => void;

  constructor(writer: WritableStreamDefaultWriter<Uint8Array>, sessionId: string) {
    this.writer = writer;
    this.sessionId = sessionId;
  }

  async start() {
    // Send endpoint event indicating where to POST messages
    // The client (ADK) will use this URL to send JSON-RPC messages
    const endpoint = `/api/mcp/system-tools/messages?sessionId=${this.sessionId}`;
    const event = `event: endpoint\ndata: ${endpoint}\n\n`;
    await this.writer.write(this.encoder.encode(event));
  }

  async send(message: JSONRPCMessage) {
    const data = JSON.stringify(message);
    const event = `event: message\ndata: ${data}\n\n`;
    await this.writer.write(this.encoder.encode(event));
  }

  async close() {
    try {
      await this.writer.close();
    } catch {
      // Ignore if already closed
    }
    this.onclose?.();
  }
  
  // Handle incoming message from POST request
  async handleMessage(message: JSONRPCMessage) {
    this.onmessage?.(message);
  }
}
