// @metwily/tools/fs — ACI مجردة وحقيقية: read/search/edit/run/check
// قرار المجلس: شرائح فقط + truncation + deny-list + read-before-edit.
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadConfig } from "./config.js";
import { evaluateRun, tokenize } from "./policy.js";

export const READ_SLICE_LINES = 50;
export const MAX_FILE_LINES = 400;
export const TOOL_OUTPUT_TRUNCATE = 2000;

// القوائم الافتراضية انتقلت إلى policy.ts (مصدر واحد) — تُضبط من metwily.json.
export { DEFAULT_ALLOW_RUN, DEFAULT_DENY_PATTERNS } from "./policy.js";

// يتتبع الملفات المقروءة — edit مرفوضة بدون read مسبق
export const readFiles = new Set<string>();

// درس opencode/truncate.ts: المخرجات الطويلة تُحفظ كاملة في ملف spill
// ويُعرض معاينة + تلميح — لا يُرمى المحتوى أبداً.
export async function spill(cwd: string, text: string): Promise<string> {
  const dir = path.join(cwd, ".metwily", "tmp");
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
  const file = path.join(dir, `tool_${Date.now()}.log`);
  await fs.writeFile(file, text, "utf8").catch(() => {});
  return file;
}

export async function preview(cwd: string, s: string, n = TOOL_OUTPUT_TRUNCATE): Promise<string> {
  if (s.length <= n) return s;
  const file = await spill(cwd, s);
  return (
    s.slice(0, n) +
    `\n... [${s.length - n} chars truncated — الكامل محفوظ في: ${file}]\nاستخدم search فيه أو read بشرائح.`
  );
}

export function truncate(s: string, n = TOOL_OUTPUT_TRUNCATE): string {
  return s.length > n ? s.slice(0, n) + `\n... [truncated ${s.length - n} chars]` : s;
}

// درس opencode/read.ts: عند غياب الملف اقترح أقرب 3 أسماء في نفس المجلد.
export async function missHint(cwd: string, filePath: string): Promise<string> {
  const dir = path.dirname(path.resolve(cwd, filePath));
  const base = path.basename(filePath).toLowerCase();
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  const scored = entries
    .filter((e) => e.toLowerCase().includes(base) || base.includes(e.toLowerCase().replace(/\.[^.]+$/, "")))
    .slice(0, 3);
  return scored.length > 0 ? `\n\nهل تقصد؟\n${scored.join("\n")}` : "";
}

function assertInside(cwd: string, p: string): string {
  const abs = path.resolve(cwd, p);
  const root = path.resolve(cwd);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error(`خارج الـ workspace: ${p}`);
  return abs;
}

export async function readTool(cwd: string, filePath: string, offset = 1, limit = READ_SLICE_LINES): Promise<string> {
  const abs = assertInside(cwd, filePath);
  const st = await fs.stat(abs).catch(() => undefined);
  if (!st) throw new Error(`الملف غير موجود: ${filePath}${await missHint(cwd, filePath)}`);
  // درس opencode: read تدعم المجلدات — اعرض محتوياتها.
  if (st.isDirectory()) {
    const entries = (await fs.readdir(abs).catch(() => [] as string[])).sort().map((e) => (e.includes(".") ? e : e + "/"));
    const slice = entries.slice(Math.max(0, offset - 1), Math.max(0, offset - 1) + Math.min(limit, READ_SLICE_LINES));
    readFiles.add(abs);
    return `<type>directory</type>\n${slice.join("\n")}\n(${entries.length} entries)`;
  }
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
  if (results.length === 0) return "لا نتائج — جرّب pattern أبسط";
  return preview(cwd, results.join("\n"));
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

export function runTool(cwd: string, command: string, timeoutMs?: number): Promise<string> {
  return (async () => {
    const cfg = await loadConfig(cwd);
    const verdict = evaluateRun(command, cfg);
    if (verdict.decision === "deny") return `TOOL_DENIED: ${verdict.reason}`;
    const timeout = timeoutMs ?? cfg.runTimeoutMs ?? 120_000;
    const [bin, ...args] = tokenize(command);
    if (!bin) return "TOOL_DENIED: أمر فارغ";
    return new Promise<string>((resolve) => {
      execFile(bin, args, { cwd, timeout, maxBuffer: 51200 }, (err, stdout, stderr) => {
        void (async () => {
          const out = await preview(cwd, (stdout ?? "") + (stderr ? "\n[stderr]\n" + stderr : ""));
          resolve(err ? `exit!=0:\n${out}` : out || "(no output)");
        })();
      });
    });
  })();
}
