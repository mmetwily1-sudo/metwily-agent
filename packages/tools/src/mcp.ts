// @metwily/tools/mcp — عميل MCP минимаل عبر stdio (JSON-RPC 2.0).
// handshake (initialize) + tools/list + tools/call + إغلاق نظيف. بدون اعتماديات.
import { spawn, type ChildProcess } from "node:child_process";

export interface MCPToolDef {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
}

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

export class MCPClient {
  private proc: ChildProcess;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private buffer = "";

  private constructor(proc: ChildProcess) {
    this.proc = proc;
    proc.stdout?.on("data", (chunk: Buffer) => this.onData(chunk.toString("utf8")));
    proc.on("error", (err) => this.failAll(err instanceof Error ? err : new Error(String(err))));
    proc.on("exit", () => this.failAll(new Error("MCP server exited")));
  }

  static async connect(cfg: MCPServerConfig): Promise<MCPClient> {
    const proc = spawn(cfg.command, cfg.args ?? [], {
      env: { ...process.env, ...(cfg.env ?? {}) },
      stdio: ["pipe", "pipe", "ignore"],
      shell: false,
    });
    const client = new MCPClient(proc);
    const timeoutMs = cfg.timeoutMs ?? 15_000;
    await Promise.race([
      (async () => {
        await client.request("initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "metwily", version: "0.1.0" },
        });
        client.notify("notifications/initialized", {});
      })(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`MCP handshake timeout (${timeoutMs}ms): ${cfg.command}`)), timeoutMs)
      ),
    ]).catch((err) => {
      client.close();
      throw err;
    });
    return client;
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      const text = line.trim();
      if (!text) continue;
      try {
        const msg = JSON.parse(text) as { id?: number; result?: unknown; error?: { message?: string } };
        if (typeof msg.id === "number" && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          clearTimeout(p.timer);
          if (msg.error) p.reject(new Error(`MCP error: ${msg.error.message ?? "unknown"}`));
          else p.resolve(msg.result);
        }
      } catch {
        // سطر غير JSON (تحذيرات السيرفر) — يُتجاهل
      }
    }
  }

  private failAll(err: Error): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }

  request(method: string, params: unknown, timeoutMs = 30_000): Promise<unknown> {
    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.proc.stdin?.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  notify(method: string, params: unknown): void {
    this.proc.stdin?.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  async listTools(): Promise<MCPToolDef[]> {
    const res = (await this.request("tools/list", {})) as { tools?: MCPToolDef[] };
    return Array.isArray(res?.tools) ? res.tools : [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const res = (await this.request("tools/call", { name, arguments: args })) as {
      content?: Array<{ type?: string; text?: string }>;
      isError?: boolean;
    };
    const parts = Array.isArray(res?.content) ? res.content : [];
    const text = parts
      .map((p) => (typeof p?.text === "string" ? p.text : JSON.stringify(p)))
      .join("\n");
    return (res?.isError ? "[mcp-error]\n" : "") + (text || "(empty result)");
  }

  close(): void {
    this.failAll(new Error("MCP client closed"));
    this.proc.kill();
  }
}
