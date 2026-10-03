// @metwily/tools/check — أداة التحقق: typecheck إجباري قبل done (يغلق حلقة verify).
// ملاحظة: لا نستخدم `pnpm exec` لأنه يعمل من جذر الـ workspace لا من cwd —
// نجد ثنائية tsc وملف tsconfig بالصعود من cwd ليفحص المجلد الصحيح فعلاً.
import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

async function findUp(cwd: string, rel: string): Promise<string | undefined> {
  let dir = path.resolve(cwd);
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, rel);
    if (await fs.stat(candidate).then((s) => s.isFile()).catch(() => false)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
  return undefined;
}

export async function checkTool(cwd: string): Promise<string> {
  const tsconfig =
    (await findUp(cwd, "tsconfig.json")) ?? (await findUp(cwd, "tsconfig.base.json"));
  if (!tsconfig) {
    return `FAIL: لا يوجد tsconfig.json في ${cwd} أو أي مجلد أب — لا يمكن الفحص هنا`;
  }
  const tscBin =
    (await findUp(cwd, path.join("node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc"))) ?? "npx -y -p typescript tsc";
  const cmd = `"${tscBin}" --noEmit -p "${tsconfig}"`;
  const out = await new Promise<string>((resolve) => {
    exec(cmd, { cwd, timeout: 180_000, maxBuffer: 1024 * 100 }, (err, stdout, stderr) => {
      const text = `${stdout ?? ""}\n${stderr ?? ""}`.trim();
      if (err) resolve(`FAIL:\n${text.slice(0, 3000)}`);
      else resolve("✅ سليم — لا أخطاء typecheck");
    });
  });
  return out;
}
