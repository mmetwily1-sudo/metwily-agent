// @metwily/tools/fs — ACI مجردة وحقيقية: read/search/edit/run/check
// قرار المجلس: شرائح فقط + truncation + deny-list + read-before-edit.
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

export const READ_SLICE_LINES = 50;
export const MAX_FILE_LINES = 400;
export const TOOL_OUTPUT_TRUNCATE = 2000;

export const DENIED_PATTERNS = [/rm\s+-rf/, /sudo/, /curl.*\|\s*(ba)?sh/, /git\s+push/];
export const ALLOW_RUN_PREFIX = ["bun", "npm", "pnpm", "npx tsc", "tsc", "git status", "git diff", "ls", "node"];

// يتتبع الملفات المقروءة — edit مرفوضة بدون read مسبق
export const readFiles = new Set<string>();

function truncate(s: string, n = TOOL_OUTPUT_TRUNCATE): string {
  return s.length > n ? s.slice(0, n) + `\n... [truncated ${s.length - n} chars → .metwily/tmp]` : s;
}

function assertInside(cwd: string, p: string): string {
  const abs = path.resolve(cwd, p);
  const root = path.resolve(cwd);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error(`خارج الـ workspace: ${p}`);
  return abs;
}

export async function readTool(cwd: string, filePath: string, offset = 1, limit = READ_SLICE_LINES): Promise<string> {
  const abs = assertInside(cwd, filePath);
  const raw = await fs.readFile(abs, "utf8");
  const lines = raw.split("\n");
  if (lines.length > MAX_FILE_LINES && limit >= MAX_FILE_LINES) {
    throw new Error(`الملف كبير (${lines.length} سطر) — استخدم search أولاً ثم read بشرائح ≤${READ_SLICE_LINES}`);
  }
  const slice = lines.slice(Math.max(0, offset - 1), Math.max(0, offset - 1) + Math.min(limit, READ_SLICE_LINES));
  readFiles.add(path.resolve(cwd, filePath));
  return slice.map((l, i) => `${offset + i}: ${l.length > 2000 ? l.slice(0, 2000) + "…" : l}`).join("\n");
}

export async function searchTool(cwd: string, pattern: string): Promise<string> {
  // بحث بسيط بدون dependencies — يمشي على الشجرة حتى 30 نتيجة
  const results: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 6 || results.length >= 30) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "dist") continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full, depth + 1);
      else if (/\.([tj]s|[tj]sx|json|md)$/.test(e.name)) {
        const text = await fs.readFile(full, "utf8").catch(() => "");
        const lines = text.split("\n");
        lines.forEach((l, i) => {
          if (results.length < 30 && l.includes(pattern)) {
            results.push(`${path.relative(cwd, full)}:${i + 1}: ${l.slice(0, 160)}`);
          }
        });
      }
    }
  }
  await walk(cwd, 0);
  return truncate(results.join("\n") || "لا نتائج — جرّب pattern أبسط");
}

export async function editTool(cwd: string, filePath: string, oldString: string, newString: string): Promise<string> {
  const key = path.resolve(cwd, filePath);
  if (!readFiles.has(key) && !readFiles.has(filePath)) {
    throw new Error(`ممنوع edit بدون read مسبق لـ ${filePath} — اقرأ الملف أولاً`);
  }
  const abs = assertInside(cwd, filePath);
  const raw = await fs.readFile(abs, "utf8");
  const idx = raw.indexOf(oldString);
  if (idx === -1) throw new Error("oldString مش موجود حرفياً — انسخ من read بالضبط");
  if (raw.indexOf(oldString, idx + 1) !== -1) throw new Error("oldString متكرر — حدد سياق أكبر ليكون فريداً");
  await fs.writeFile(abs, raw.slice(0, idx) + newString + raw.slice(idx + oldString.length), "utf8");
  return `تم التعديل في ${filePath}`;
}

function denied(cmd: string): boolean {
  return DENIED_PATTERNS.some((re) => re.test(cmd));
}

export function runTool(cwd: string, command: string, timeoutMs = 120_000): Promise<string> {
  if (denied(command)) return Promise.resolve("TOOL_DENIED: أمر خطر مرفوض");
  const ok = ALLOW_RUN_PREFIX.some((p) => command === p || command.startsWith(p + " ") || command.startsWith(p + "	"));
  if (!ok) return Promise.resolve("TOOL_DENIED: خارج الـ allowlist — المتاح: " + ALLOW_RUN_PREFIX.join(", "));
  const [bin, ...args] = command.split(/\s+/);
  return new Promise((resolve) => {
    execFile(bin, args, { cwd, timeout: timeoutMs, maxBuffer: 51200 }, (err, stdout, stderr) => {
      const out = truncate((stdout ?? "") + (stderr ? "\n[stderr]\n" + stderr : ""));
      resolve(err ? `exit!=0:\n${out}` : out || "(no output)");
    });
  });
}
