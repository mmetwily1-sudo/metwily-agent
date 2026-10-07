// mini-eval لمتولي: 5 سيناريوهات مركّبة تحاكي مسارات الوكيل الحقيقية
// (map → read → verify) — حتمية وبدون LLM. المعيار: كل سيناريو يجب أن ينجح.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { compactHistory, loadHistory, saveHistory } from "../packages/core/src/agent.js";
import { preview } from "../packages/tools/src/fs.js";
import { editTool, readTool, runTool, searchTool } from "../packages/tools/src/fs.js";
import { buildRepoMap } from "../packages/tools/src/repomap.js";

const cwd = process.cwd();
const scratch = path.join(cwd, "tmp-eval");

interface Result {
  name: string;
  pass: boolean;
  detail: string;
}

async function scenario(name: string, fn: () => Promise<string>): Promise<Result> {
  try {
    const detail = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout 60s")), 60_000)),
    ]);
    return { name, pass: true, detail };
  } catch (e) {
    return { name, pass: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

await rm(scratch, { recursive: true, force: true });
await mkdir(scratch, { recursive: true });

const results: Result[] = [];

// 1. تحديد رمز: map → read → سطر صحيح (مسار الوكيل عند سؤال "أين runAgent؟")
results.push(await scenario("locate-symbol", async () => {
  const map = await buildRepoMap(cwd, new Set());
  assert(map.includes("agent.ts"), "الخريطة لا تذكر agent.ts");
  const hits = (await searchTool(cwd, "export async function runAgent")).replace(/\\/g, "/");
  assert(hits.includes("packages/core/src/agent.ts"), `البحث لم يجد التعريف: ${hits.slice(0, 80)}`);
  const line = hits.split("\n")[0];
  const lineno = Number(line.split(":")[1]);
  const slice = await readTool(cwd, "packages/core/src/agent.ts", lineno, 2);
  assert(slice.includes("export async function runAgent"), "الشريحة لا تطابق");
  return `وجد في agent.ts:${lineno}`;
}));

// 2. حلقة إصلاح آمنة: نسخة scratch (read → edit → تحقق) دون لمس الريبو
results.push(await scenario("safe-edit-loop", async () => {
  const f = path.join(scratch, "note.md");
  await writeFile(f, "السعر 100 جنيه\n", "utf8");
  await readTool(scratch, "note.md");
  const out = await editTool(scratch, "note.md", "100", "150");
  assert(out.includes("تم التعديل"), "فشل التعديل");
  const after = await readFile(f, "utf8");
  assert(after.includes("150"), "المحتوى لم يتغير");
  return "تعديل موثق في scratch";
}));

// 3. مقاومة التصعيد: أوامر خطرة مرفوضة حتى لو طُلبت صراحة
results.push(await scenario("deny-escalation", async () => {
  const denials = await Promise.all([
    runTool(cwd, "git push origin main"),
    runTool(cwd, "rm -rf /tmp/x"),
    runTool(cwd, "sudo ls"),
  ]);
  assert(denials.every((d) => d.startsWith("TOOL_DENIED")), `تسرب أمر خطر: ${denials.join(" | ").slice(0, 120)}`);
  return "3/3 مرفوضة";
}));

// 4. فيض المخرجات:(long output) يُحفظ كاملاً ويُعرض معاينة بمسار حقيقي
results.push(await scenario("blowup-spill", async () => {
  const big = "سطر\n".repeat(5000);
  const pv = await preview(cwd, big);
  assert(pv.length < big.length, "لا تقليص حدث");
  const m = pv.match(/\.metwily[\\/]tmp[\\/][^)\s]+\.log/);
  assert(m !== null && typeof m[0] === "string", "لا مسار spill في المعاينة");
  const spillRel: string = (m as RegExpMatchArray)[0];
  const saved = await readFile(path.join(cwd, spillRel.replace(/\\/g, "/")), "utf8");
  assert(saved.length === big.length, "المحفوظ ناقص");
  return `معاينة ${pv.length} من ${big.length} + spill كامل`;
}));

// 5. استمرارية الجلسة: حفظ → تحميل → ضغط (دورة --resume كاملة)
results.push(await scenario("session-resume", async () => {
  const fake = Array.from({ length: 14 }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `q${i}-` + "نص ".repeat(2000),
  }));
  const { history, compacted } = compactHistory(fake, 10, 60_000);
  assert(compacted && history.length < fake.length, "لم يحدث ضغط");
  assert(history[0].content.startsWith("q0-"), "الهدف الأصلي ضاع");
  await saveHistory(scratch, history);
  const loaded = await loadHistory(scratch);
  assert(loaded.length === history.length, "الحفظ/التحميل غير متطابق");
  return `ضُغطت 14 → ${history.length} + roundtrip سليم`;
}));

// 6. حلقة التحقق الكاملة: كسر → check أحمر → read → edit → check أخضر (قلب الـ verify loop)
results.push(await scenario("verify-loop", async () => {
  const fix = path.join(cwd, "tmp-eval-fix");
  await rm(fix, { recursive: true, force: true });
  await mkdir(fix, { recursive: true });
  await writeFile(
    path.join(fix, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ["bad.ts"] }),
    "utf8"
  );
  await writeFile(path.join(fix, "bad.ts"), 'export const x: number = "oops";\n', "utf8");
  const { checkTool } = await import("../packages/tools/src/check.js");
  const red = await checkTool(fix);
  assert(red.startsWith("FAIL"), `كان يجب أن يفشل: ${red.slice(0, 80)}`);
  await readTool(fix, "bad.ts");
  await editTool(fix, "bad.ts", '"oops"', "42");
  const green = await checkTool(fix);
  await rm(fix, { recursive: true, force: true });
  assert(green.startsWith("✅"), `كان يجب أن ينجح: ${green.slice(0, 80)}`);
  return "أحمر → إصلاح → أخضر";
}));

await rm(scratch, { recursive: true, force: true });

console.log("\n== mini-eval ==");
let pass = 0;
for (const r of results) {
  if (r.pass) pass++;
  console.log(`${r.pass ? "✅" : "❌"} ${r.name} — ${r.detail.slice(0, 90)}`);
}
console.log(`النتيجة: ${pass}/${results.length}`);
if (pass !== results.length) process.exitCode = 1;
