// @metwily/core/agent — الـ loop الحقيقي: streamText + tools + budget guard
// قرار المجلس: observe → plan → act → verify، max 15 خطوة، audit log.
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { stepCountIs, streamText, tool } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { SYSTEM_AR, getCandidateModels, isQuotaError } from "@metwily/llm/router.js";
import { costOf } from "@metwily/llm/costs.js";
import type { CostReport, TokenUsage } from "@metwily/llm/costs.js";
import { loadMCPTools } from "./mcp-tools.js";
import { loadConfig } from "@metwily/tools/config.js";
import { editTool, readFiles, readTool, runTool, searchTool } from "@metwily/tools/fs.js";
import { autoCommitFile } from "@metwily/tools/git.js";
import { buildRepoMap } from "@metwily/tools/repomap.js";
import { checkTool } from "@metwily/tools/check.js";

export const MAX_STEPS = 15;
export const COMPACTION_AT = 0.7;

export function mustReadBeforeEdit(readFiles: Set<string>, file: string): boolean {
  return readFiles.has(file);
}

export interface RunOptions {
  cwd: string;
  mode: "plan" | "build";
  onText?: (delta: string) => void;
  onUsage?: (report: CostReport) => void;
  autoCommit?: boolean; // يتجاوز config (يُستخدم مع --no-commit)
  maxSteps?: number; // يتجاوز config
}

// درس opencode/compaction.ts + session persistence:
// الجلسة تُحفظ في .metwily/state.json (آخر prompt + رد مختصر).
// الـ compaction هنا rule-based v1: نحتفظ بالهدف الأول + آخر 10 تبادلات،
// والترقية لملخص LLM موثقة في docs/learnings-opencode.md.
export interface StoredMsg {
  role: "user" | "assistant";
  content: string;
}

const HISTORY_CHARS_CAP = 60_000;
const HISTORY_KEEP_LAST = 10;
void HISTORY_CHARS_CAP;
void HISTORY_KEEP_LAST;

export async function loadHistory(cwd: string): Promise<StoredMsg[]> {
  const raw = await readFile(path.join(cwd, ".metwily", "state.json"), "utf8").catch(() => "");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { messages?: StoredMsg[] };
    return Array.isArray(parsed.messages) ? parsed.messages : [];
  } catch {
    return [];
  }
}

export function compactHistory(
  history: StoredMsg[],
  keepLast = 10,
  charsCap = 60_000
): { history: StoredMsg[]; compacted: boolean } {
  const total = history.reduce((n, m) => n + m.content.length, 0);
  if (history.length <= keepLast + 1 || total <= charsCap) return { history, compacted: false };
  const head = history[0];
  const tail = history.slice(-keepLast);
  const dropped = history.length - tail.length - 1;
  const marker: StoredMsg = {
    role: "assistant",
    content: `[ملخص تلقائي: تم ضغط ${dropped} تبادلات قديمة لتوفير السياق. الهدف الأصلي محفوظ أعلاه.]`,
  };
  return { history: [head, marker, ...tail], compacted: true };
}

export async function saveHistory(cwd: string, history: StoredMsg[]): Promise<void> {
  const dir = path.join(cwd, ".metwily");
  await mkdir(dir, { recursive: true }).catch(() => {});
  await writeFile(path.join(dir, "state.json"), JSON.stringify({ messages: history }, null, 2), "utf8").catch(() => {});
}

async function audit(cwd: string, entry: Record<string, unknown>): Promise<void> {
  const dir = path.join(cwd, ".metwily");
  await mkdir(dir, { recursive: true }).catch(() => {});
  await appendFile(path.join(dir, "audit.log.jsonl"), JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n").catch(() => {});
}

export async function runAgent(prompt: string, opts: RunOptions): Promise<string> {
  const { cwd, mode, onText } = opts;
  const cfg = await loadConfig(cwd);
  const autoCommit = opts.autoCommit ?? cfg.autoCommit;
  const rawHistory = await loadHistory(cwd);
  const { history, compacted } = compactHistory(rawHistory, cfg.historyKeepLast, cfg.historyCharsCap);
  const mcp = await loadMCPTools(cwd, (entry) => audit(cwd, entry));
  const tools = {
    map: tool({
      description: "خريطة رموز الريبو (PageRank) — ابدأ بها لفهم المشروع قبل القراءة.",
      inputSchema: z.object({}),
      execute: async () => {
        const out = await buildRepoMap(cwd, readFiles);
        await audit(cwd, { tool: "map", chars: out.length });
        return out;
      },
    }),
    read: tool({
      description: "قراءة شريحة من ملف (offset/limit). إجباري قبل أي edit.",
      inputSchema: z.object({ filePath: z.string(), offset: z.number().default(1), limit: z.number().default(50) }),
      execute: async ({ filePath, offset, limit }) => {
        const out = await readTool(cwd, filePath, offset, limit);
        await audit(cwd, { tool: "read", filePath });
        return out;
      },
    }),
    search: tool({
      description: "بحث نصي في المشروع. استخدمه قبل قراءة ملفات كبيرة.",
      inputSchema: z.object({ pattern: z.string(), include: z.string().default("**/*.ts") }),
      execute: async ({ pattern }) => {
        const out = await searchTool(cwd, pattern);
        await audit(cwd, { tool: "search", pattern });
        return out;
      },
    }),
    check: tool({
      description: "فحص typecheck للمشروع. إجباري بعد أي edit وقبل done.",
      inputSchema: z.object({}),
      execute: async () => {
        const out = await checkTool(cwd);
        await audit(cwd, { tool: "check", pass: out.startsWith("✅") });
        return out;
      },
    }),
    ...(mode === "build"
      ? {
          edit: tool({
            description: "تعديل دقيق باستبدال حرفي واحد فريد. ممنوع بدون read مسبق.",
            inputSchema: z.object({ filePath: z.string(), oldString: z.string(), newString: z.string() }),
            execute: async ({ filePath, oldString, newString }) => {
              const out = await editTool(cwd, filePath, oldString, newString);
              const committed = await autoCommitFile(cwd, filePath, autoCommit);
              await audit(cwd, { tool: "edit", filePath, committed: Boolean(committed) });
              return out + committed;
            },
          }),
          run: tool({
            description: "تنفيذ أمر من الـ allowlist فقط (tsc/tests/git status). أي خطر = DENIED.",
            inputSchema: z.object({ command: z.string() }),
            execute: async ({ command }) => {
              const out = await runTool(cwd, command);
              await audit(cwd, { tool: "run", command: command.slice(0, 120) });
              return out;
            },
          }),
        }
      : {}),
    ...mcp.tools,
  };

  const systemText =
    (mode === "plan" ? SYSTEM_AR + "\nوضع PLAN: اعرض الخطة فقط، لا تستخدم edit/run." : SYSTEM_AR) +
    "\nابدأ بأداة map لفهم المشروع قبل أي قراءة." +
    (compacted ? "\n[ملاحظة: تم ضغط تاريخ الجلسة — اعتمد على الهدف الأصلي وآخر التبادلات.]" : "") +
    (history.length > 0 ? "\n[سياق الجلسة السابقة مختصر — أكمل من حيث توقفت.]" : "");
  const promptText =
    history.length > 0
      ? `السياق السابق:\n${history.map((m) => `### ${m.role}\n${m.content.slice(0, 4000)}`).join("\n")}\n\n---\nالمطلوب الآن: ${prompt}`
      : prompt;

  const runOnce = async (model: LanguageModel): Promise<{ text: string; usage?: TokenUsage }> => {
    const result = streamText({
      model,
      system: systemText,
      prompt: promptText,
      tools,
      stopWhen: stepCountIs(opts.maxSteps ?? cfg.maxSteps),
    });
    let full = "";
    for await (const delta of result.textStream) {
      full += delta;
      onText?.(delta);
    }
    // استهلاك كامل للستريم يضمن انتهاء كل خطوات الأدوات (stopWhen)
    const settled = result as unknown as { finishReason?: Promise<unknown>; usage?: Promise<TokenUsage> };
    await settled.finishReason?.catch(() => undefined);
    const usage = await settled.usage?.catch(() => undefined);
    return { text: full, usage };
  };

  // تناوب تلقائي: عند نفاد الحصة جرّب المرشح التالي (مفتاح/ollama/بوابة).
  const candidates = await getCandidateModels(cwd);
  let full: string | undefined;
  let usedLabel = candidates[0]?.label ?? "unknown";
  let lastErr: unknown;
  let lastUsage: TokenUsage | undefined;
  try {
    for (let i = 0; i < candidates.length; i++) {
      try {
        const r = await runOnce(candidates[i].model);
        full = r.text;
        lastUsage = r.usage;
        usedLabel = candidates[i].label;
        if (i > 0) await audit(cwd, { tool: "fallback", candidate: usedLabel });
        break;
      } catch (err) {
        if (!isQuotaError(err)) throw err;
        lastErr = err;
        onText?.(`\n[الحصة ممتلئة — تجربة البديل ${i + 1}/${candidates.length - 1}...]\n`);
      }
    }
  } finally {
    mcp.close();
  }
  if (full === undefined) throw lastErr;
  if (lastUsage) {
    const report = costOf(usedLabel, lastUsage);
    await audit(cwd, { tool: "usage", ...report });
    opts.onUsage?.(report);
  }
  const next = compactHistory(
    [...history, { role: "user", content: prompt }, { role: "assistant", content: full }],
    cfg.historyKeepLast,
    cfg.historyCharsCap
  ).history;
  await saveHistory(cwd, next);
  await audit(cwd, { tool: "done", mode, chars: full.length, compacted });
  return full;
}
