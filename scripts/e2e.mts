// scripts/e2e.mts — اختبار end-to-end حقيقي للـ loop كاملاً (بدون حصة):
// مشروع وهمي + مزود echo الحتمي → runAgent → التحقق من مسار التدقيق بالترتيب.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { runAgent } from "../packages/core/src/agent.js";

const cwd = process.cwd();
const proj = path.join(cwd, "tmp-e2e-proj");
await rm(proj, { recursive: true, force: true });
await mkdir(proj, { recursive: true });
await writeFile(path.join(proj, "package.json"), JSON.stringify({ name: "demo-proj" }, null, 2), "utf8");
await writeFile(path.join(proj, "README.md"), "# demo\n", "utf8");

process.env.METWILY_PROVIDER = "echo";
process.env.METWILY_YES = "1";

const text = await runAgent("مهمة تجريبية", { cwd: proj, mode: "plan" });

let pass = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) pass++;
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
};

ok("الرد النهائي وصل", text.includes("end-to-end"), text.slice(0, 60));

const auditRaw = await readFile(path.join(proj, ".metwily", "audit.log.jsonl"), "utf8");
const tools = auditRaw.split("\n").filter(Boolean).map((l) => (JSON.parse(l) as { tool: string }).tool);
const mi = tools.indexOf("map");
const ri = tools.indexOf("read");
const di = tools.indexOf("done");
ok("مسار map → read → done بالترتيب", mi !== -1 && ri !== -1 && di !== -1 && mi < ri && ri < di, tools.join(">"));

const stateRaw = await readFile(path.join(proj, ".metwily", "state.json"), "utf8");
const state = JSON.parse(stateRaw) as { messages: Array<{ role: string }> };
ok("الجلسة محفوظة", state.messages.length === 2 && state.messages[0].role === "user", `${state.messages.length} msgs`);

await rm(proj, { recursive: true, force: true });
console.log(`\nE2E: ${pass}/3`);
if (pass !== 3) process.exitCode = 1;
