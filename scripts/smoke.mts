// smoke test للأدوات — يعمل من جذر الريبو عبر tsx (لا يحتاج API key)
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { editTool, readFiles, readTool, runTool, searchTool } from "../packages/tools/src/fs.js";
import { compactHistory } from "../packages/core/src/agent.js";
import type { StoredMsg } from "../packages/core/src/agent.js";
import { buildRepoMap } from "../packages/tools/src/repomap.js";
import { autoCommitFile, isGitRepo } from "../packages/tools/src/git.js";
import { DEFAULT_CONFIG, loadConfig } from "../packages/tools/src/config.js";
import { checkTool } from "../packages/tools/src/check.js";
import { evaluateRun, tokenize } from "../packages/tools/src/policy.js";
import { clearConfigCache } from "../packages/tools/src/config.js";
import { MCPClient } from "../packages/tools/src/mcp.js";
import { costOf } from "../packages/llm/src/costs.js";
import { geminiKeys, getModelId } from "../packages/llm/src/router.js";
import { execFile } from "node:child_process";

const cwd = process.cwd();
const scratch = path.join(cwd, "tmp-smoke");
await rm(scratch, { recursive: true, force: true });
await mkdir(scratch, { recursive: true });
await writeFile(path.join(scratch, "a.md"), "hello\nworld\n", "utf8");

let pass = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) pass++;
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
};

// 1. read شريحة
const r1 = await readTool(scratch, "a.md", 1, 50);
ok("read شريحة", r1.includes("1: hello") && r1.includes("2: world"), JSON.stringify(r1));

// 2. search يجد نتيجة (استخدم readFiles كشاهد أن read سجلت)
const s1 = await searchTool(scratch, "world");
ok("search يجد", s1.includes("a.md:2"), JSON.stringify(s1.slice(0, 60)));

// 3. edit بدون read مسبق → مرفوضة
readFiles.clear();
let denied = "";
try {
  await editTool(scratch, "a.md", "world", "WORLD");
} catch (e) {
  denied = e instanceof Error ? e.message : String(e);
}
ok("edit بدون read مرفوضة", denied.includes("ممنوع edit"), denied.slice(0, 50));

// 4. read ثم edit → ناجحة
await readTool(scratch, "a.md");
const e1 = await editTool(scratch, "a.md", "world", "WORLD");
ok("read ثم edit ناجحة", e1.includes("تم التعديل"), e1);

// 5. run مسموح (git status)
const g1 = await runTool(cwd, "git status --short");
ok("run المسموح يعمل", !g1.startsWith("TOOL_DENIED"), g1.slice(0, 60));

// 6. run خطر → DENIED
const bad = await runTool(cwd, "rm -rf /tmp/x");
ok("run الخطر مرفوض", bad.startsWith("TOOL_DENIED"), bad.slice(0, 40));

// 7. run خارج allowlist → DENIED
const oob = await runTool(cwd, "python --version");
ok("run خارج القائمة مرفوض", oob.startsWith("TOOL_DENIED"));

// 8. ملف مفقود → اقتراح "هل تقصد"
let miss = "";
try {
  await readTool(scratch, "a.m");
} catch (e) {
  miss = e instanceof Error ? e.message : String(e);
}
ok("الملف المفقود يقترح", miss.includes("هل تقصد") && miss.includes("a.md"), miss.slice(0, 60));

// 9. read مجلد → قائمة محتويات
const dir = await readTool(cwd, "tmp-smoke");
ok("read المجلد يعرض", dir.includes("<type>directory</type>") && dir.includes("a.md"), dir.slice(0, 80));

// 10. compaction يقلص التاريخ الطويل
const long: StoredMsg[] = Array.from({ length: 15 }, (_, i) => ({
  role: i % 2 === 0 ? "user" : "assistant",
  content: `msg-${i}-` + "x".repeat(6000),
}));
const { history: compacted, compacted: did } = compactHistory(long);
ok("compaction يقلص", did && compacted.length < long.length && compacted[0].content.includes("msg-0"), `→ ${compacted.length} msgs`);

// 11. repo-map يبني خريطة فيها رموز حقيقية + cache
const map1 = await buildRepoMap(cwd, new Set());
ok("repo-map فيه رموز", map1.includes("readTool") && map1.includes("runAgent"), map1.slice(0, 60).replace(/\n/g, " | "));

// 12. auto-commit يوثق التعديل في git
const grepo = path.join(cwd, "tmp-git-smoke");
await rm(grepo, { recursive: true, force: true });
await mkdir(grepo, { recursive: true });
const sh = (args: string[]) =>
  new Promise<string>((resolve) => execFile("git", args, { cwd: grepo }, (e, o) => resolve(e ? "ERR" : o)));
await sh(["init"]);
await sh(["config", "user.email", "t@t"]);
await sh(["config", "user.name", "t"]);
await writeFile(path.join(grepo, "f.md"), "one\n", "utf8");
await sh(["add", "."]);
await sh(["commit", "-m", "init"]);
await readTool(grepo, "f.md");
await editTool(grepo, "f.md", "one", "two");
const committed = await autoCommitFile(grepo, "f.md", true);
const log = await sh(["log", "--oneline"]);
ok("auto-commit يوثق", committed.includes("metwily: edit") && log.includes("metwily: edit"), committed);
const off = await autoCommitFile(grepo, "f.md", false);
ok("تعطيل auto-commit", off === "", "يُحترم الـ flag");
await rm(grepo, { recursive: true, force: true });

// 13. config الافتراضي + repo الحالي git
const cfg = await loadConfig(cwd);
ok("config افتراضي", cfg.autoCommit === DEFAULT_CONFIG.autoCommit && cfg.maxSteps === 15, JSON.stringify(cfg).slice(0, 80));
ok("الريبو git", await isGitRepo(cwd));

// 16. check سليم على الريبو
const chk = await checkTool(cwd);
ok("check سليم", chk.startsWith("✅"), chk.slice(0, 60));

// 17. check يفشل بوضوح خارج أي مشروع (مجلد خارج الريبو بلا tsconfig في الأباء)
const emptyDir = path.join(cwd, "..", "..", "check-empty-smoke");
await rm(emptyDir, { recursive: true, force: true });
await mkdir(emptyDir, { recursive: true });
const chkBad = await checkTool(emptyDir);
ok("check يفشل بوضوح", chkBad.startsWith("FAIL"), chkBad.slice(0, 60));
await rm(emptyDir, { recursive: true, force: true });

// 18. حساب التكلفة: مليون in + مليون out على deepseek-chat = 0.27 + 1.10
const rep = costOf("deepseek/deepseek-chat#1", { inputTokens: 1_000_000, outputTokens: 1_000_000 });
ok("حساب التكلفة", Math.abs((rep.costUsd ?? 0) - 1.37) < 1e-9 && rep.totalTokens === 2_000_000, `$${rep.costUsd}`);

// 19. تجاوز الموديل عبر البيئة (يستخدمه --model)
process.env.METWILY_MODEL = "deepseek-reasoner";
const mid = await getModelId(cwd);
delete process.env.METWILY_MODEL;
ok("تجاوز الموديل", mid === "deepseek-reasoner", mid);

// 20. قراءة مفاتيح التناوب من البيئة
process.env.GEMINI_API_KEY_7 = "k7-test";
const keys = geminiKeys();
delete process.env.GEMINI_API_KEY_7;
ok("قراءة مفاتيح التناوب", keys.includes("k7-test"), `${keys.length} keys`);

// 21-23. عميل MCP ضد سيرفر وهمي (handshake + list + call)
const mcp = await MCPClient.connect({ command: "node", args: ["scripts/fake-mcp.mjs"], timeoutMs: 10_000 });
const mcpTools = await mcp.listTools();
ok("MCP handshake + list", mcpTools.some((t) => t.name === "echo"), mcpTools.map((t) => t.name).join(","));
const echo = await mcp.callTool("echo", { text: "مرحبا" });
ok("MCP call", echo.includes("صدى: مرحبا"), echo.slice(0, 40));
let mcpTimeout = "";
try {
  // السيرفر الوهمي لا يرد على ping-never أبداً — يجب أن ينفد الوقت بوضوح
  await mcp.request("ping-never", {}, 300);
} catch (e) {
  mcpTimeout = e instanceof Error ? e.message : String(e);
}
ok("MCP timeout واضح", mcpTimeout.includes("timeout"), mcpTimeout.slice(0, 40));
mcp.close();

// 24. تحليل الأوامر يحترم الاقتباس
const toks = tokenize(`git commit -m "hello world"`);
ok("tokenize باقتباس", JSON.stringify(toks) === JSON.stringify(["git", "commit", "-m", "hello world"]), toks.join("|"));

// 25. المنع المخصص يغلب السماح
const v25 = evaluateRun("git status", { denyRun: ["git status"] });
ok("deny المخصص يغلب", v25.decision === "deny", v25.reason.slice(0, 50));

// 26. السماح المخصص يفتح أمراً جديداً
const v26 = evaluateRun("echo hi", { allowRun: ["echo"] });
ok("allow المخصص يعمل", v26.decision === "allow", v26.reason);
const v26b = evaluateRun("echo hi");
ok("الافتراضي يرفض echo", v26b.decision === "deny", "");

// 27. دمج metwily.json في مجلد جديد
const cfgDir = path.join(cwd, "tmp-cfg-smoke");
await rm(cfgDir, { recursive: true, force: true });
await mkdir(cfgDir, { recursive: true });
await writeFile(path.join(cfgDir, "metwily.json"), JSON.stringify({ allowRun: ["echo"], maxSteps: 5 }), "utf8");
clearConfigCache();
const cfg2 = await loadConfig(cfgDir);
await rm(cfgDir, { recursive: true, force: true });
ok("دمج الضبط", cfg2.maxSteps === 5 && (cfg2.allowRun ?? []).includes("echo") && cfg2.autoCommit === true, `maxSteps=${cfg2.maxSteps}`);

await rm(scratch, { recursive: true, force: true });
console.log(`\nالنتيجة: ${pass}/28`);
if (pass !== 28) process.exitCode = 1;
