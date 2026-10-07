// scripts/server-test.mts — اختبار السيرفر داخلياً (بدون حصة: مزود echo).
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { startServer } from "../packages/server/src/index.js";

const cwd = process.cwd();
const proj = path.join(cwd, "tmp-server-proj");
await rm(proj, { recursive: true, force: true });
await mkdir(proj, { recursive: true });
await writeFile(path.join(proj, "package.json"), JSON.stringify({ name: "srv-demo" }), "utf8");

process.env.METWILY_PROVIDER = "echo";

const srv = await startServer(0);
let pass = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) pass++;
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
};

const h = await (await fetch(`${srv.url}/healthz`)).json() as { ok: boolean };
ok("healthz", h.ok === true);

const bad = await fetch(`${srv.url}/v1/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
ok("400 بدون prompt", bad.status === 400);

const page = await fetch(`${srv.url}/`);
ok("الواجهة HTML", page.status === 200 && (await page.text()).includes("متولي"));

const res = await fetch(`${srv.url}/v1/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "تجربة", mode: "plan", cwd: proj }),
});
const sse = await res.text();
ok("SSE يكتمل", sse.includes("[DONE]") && sse.includes("end-to-end"), sse.slice(0, 80).replace(/\n/g, " | "));

await srv.close();
await rm(proj, { recursive: true, force: true });
console.log(`\nSERVER: ${pass}/4`);
if (pass !== 4) process.exitCode = 1;
