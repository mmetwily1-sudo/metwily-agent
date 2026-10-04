// سيرفر MCP وهمي للاختبار فقط (stdio JSON-RPC) — أداة echo واحدة.
// يُستخدم في smoke.mts ولا يُرفع (داخل .metwily المُتجاهَل).
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const respond = (payload) => process.stdout.write(JSON.stringify(payload) + "\n");
  if (msg.method === "initialize") {
    respond({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: { name: "fake", version: "0.0.1" } } });
  } else if (msg.method === "tools/list") {
    respond({
      jsonrpc: "2.0",
      id: msg.id,
      result: { tools: [{ name: "echo", description: "يعيد النص", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } }] },
    });
  } else if (msg.method === "tools/call") {
    const text = msg.params?.arguments?.text ?? "";
    respond({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: `صدى: ${text}` }] } });
  }
  // notifications بلا id تُتجاهل
});
