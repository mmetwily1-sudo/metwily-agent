// @metwily/core/mcp-tools — تحميل سيرفرات MCP من metwily.json كأدوات dynamic للوكيل.
// الفشل في سيرفر يُسجَّل ويُتجاوز — لا يكسر الجلسة أبداً.
import { dynamicTool, jsonSchema } from "ai";
import { loadConfig } from "@metwily/tools/config.js";
import { MCPClient } from "@metwily/tools/mcp.js";
import { preview } from "@metwily/tools/fs.js";

export interface LoadedMCP {
  tools: Record<string, ReturnType<typeof dynamicTool>>;
  close: () => void;
}

const NAME_RE = /[^a-zA-Z0-9_]/g;

export async function loadMCPTools(
  cwd: string,
  onAudit: (entry: Record<string, unknown>) => Promise<void>
): Promise<LoadedMCP> {
  const cfg = await loadConfig(cwd);
  const servers = cfg.mcpServers ?? {};
  const tools: LoadedMCP["tools"] = {};
  const clients: MCPClient[] = [];

  for (const [server, scfg] of Object.entries(servers)) {
    let client: MCPClient;
    try {
      client = await MCPClient.connect({ command: scfg.command, args: scfg.args, env: scfg.env });
    } catch (err) {
      await onAudit({ tool: "mcp-skip", server, reason: err instanceof Error ? err.message : String(err) });
      continue;
    }
    clients.push(client);
    let defs: Awaited<ReturnType<MCPClient["listTools"]>>;
    try {
      defs = await client.listTools();
    } catch {
      continue;
    }
    for (const def of defs) {
      const name = `mcp_${server}_${def.name}`.replace(NAME_RE, "_").slice(0, 64);
      tools[name] = dynamicTool({
        description: `[mcp/${server}] ${def.description ?? def.name}`.slice(0, 500),
        inputSchema: jsonSchema((def.inputSchema ?? { type: "object" }) as Parameters<typeof jsonSchema>[0]),
        execute: async (input) => {
          const args = (input ?? {}) as Record<string, unknown>;
          const out = await client.callTool(def.name, args);
          await onAudit({ tool: name, chars: out.length });
          return preview(cwd, out);
        },
      });
    }
    await onAudit({ tool: "mcp-loaded", server, count: defs.length });
  }

  return { tools, close: () => clients.forEach((c) => c.close()) };
}
