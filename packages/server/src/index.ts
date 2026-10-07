// @metwily/server — سيرفر HTTP رفيع فوق نفس الـ loop (بدون اعتماديات).
// GET /healthz | GET / (واجهة) | POST /v1/chat (SSE).
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runAgent } from "@metwily/core/index.js";

const WEB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "web");

function json(res: ServerResponse, code: number, obj: unknown): void {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 200_000) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export interface ServerHandle {
  url: string;
  close: () => Promise<void>;
}

export async function startServer(port: number): Promise<ServerHandle> {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://x");
      if (req.method === "GET" && url.pathname === "/healthz") {
        json(res, 200, { ok: true, engine: "metwily/0.1.0" });
        return;
      }
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        const html = await readFile(path.join(WEB_DIR, "index.html"), "utf8").catch(() => null);
        if (html === null) {
          json(res, 404, { error: "web UI غير مبنية" });
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/chat") {
        let body: { prompt?: string; mode?: "plan" | "build"; cwd?: string };
        try {
          body = JSON.parse(await readBody(req)) as typeof body;
        } catch {
          json(res, 400, { error: "JSON غير صالح" });
          return;
        }
        if (!body.prompt || typeof body.prompt !== "string") {
          json(res, 400, { error: "prompt مطلوب" });
          return;
        }
        const mode = body.mode === "plan" ? "plan" : "build";
        const cwd = typeof body.cwd === "string" && body.cwd ? body.cwd : process.cwd();
        res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" });
        const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
        try {
          await runAgent(body.prompt, {
            cwd,
            mode,
            onText: (d) => send({ delta: d }),
            onUsage: (r) => send({ usage: r }),
          });
          send("[DONE]");
        } catch (err) {
          send({ error: err instanceof Error ? err.message.slice(0, 300) : String(err) });
        }
        res.end();
        return;
      }
      json(res, 404, { error: "غير موجود" });
    } catch (err) {
      json(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const addr = server.address();
  const realPort = typeof addr === "object" && addr ? addr.port : port;
  return {
    url: `http://127.0.0.1:${realPort}`,
    close: () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}
