import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

async function main() {
  const url = "http://localhost:3025/api/mcp/system-tools/sse";
  console.log(`Connecting to MCP SSE: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to connect: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(text);
      return;
    }

    console.log("Connected! Reading stream...");
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    
    // Read a few chunks to verify connection
    let chunks = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      console.log(`Chunk ${++chunks}:`, text);
      
      // If we got the endpoint event, we are good
      if (text.includes("endpoint")) {
        console.log("✅ MCP Endpoint event received. Server is healthy.");
        break;
      }
      
      if (chunks > 5) break; // Timeout
    }
  } catch (err) {
    console.error("Error connecting to MCP:", err);
  }
}

main();
