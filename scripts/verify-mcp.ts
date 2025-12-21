// Use native fetch (Node 18+)
async function verify() {
  const url = 'http://localhost:3025/api/mcp/system-tools/sse';
  console.log(`Checking MCP Server at ${url}...`);
  try {
    const res = await fetch(url);
    if (res.status === 200) {
      console.log('✅ MCP Server is responding (200 OK)');
      // We expect it to hang/stream, so we abort
      // (undici fetch doesn't have abort controller by default easily in this context, but node 18+ fetch does)
    } else {
      console.error(`❌ MCP Server error: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.error(text);
    }
  } catch (e) {
    console.error('❌ Failed to connect:', e);
  }
}

verify();
