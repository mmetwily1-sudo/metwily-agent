// @metwily/core/agent — الـ loop الحقيقي: streamText + tools + budget guard
// قرار المجلس: observe → plan → act → verify، max 15 خطوة، audit log.
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { stepCountIs, streamText, tool } from "ai";
import { z } from "zod";
import { SYSTEM_AR, getModel } from "@metwily/llm/router.js";
import { editTool, readTool, runTool, searchTool } from "@metwily/tools/fs.js";

export const MAX_STEPS = 15;
export const COMPACTION_AT = 0.7;
export const READ_SLICE_LINES = 50;
export const TOOL_OUTPUT_TRUNCATE = 2000;

export function mustReadBeforeEdit(readFiles: Set<string>, file: string): boolean {
  return readFiles.has(file);
}

export interface RunOptions {
  cwd: string;
  mode: "plan" | "build";
  onText?: (delta: string) => void;
}

async function audit(cwd: string, entry: Record<string, unknown>): Promise<void> {
  const dir = path.join(cwd, ".metwily");
  await mkdir(dir, { recursive: true }).catch(() => {});
  await appendFile(path.join(dir, "audit.log.jsonl"), JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n").catch(() => {});
}

export async function runAgent(prompt: string, opts: RunOptions): Promise<string> {
  const { cwd, mode, onText } = opts;
  const tools = {
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
    ...(mode === "build"
      ? {
          edit: tool({
            description: "تعديل دقيق باستبدال حرفي واحد فريد. ممنوع بدون read مسبق.",
            inputSchema: z.object({ filePath: z.string(), oldString: z.string(), newString: z.string() }),
            execute: async ({ filePath, oldString, newString }) => {
              const out = await editTool(cwd, filePath, oldString, newString);
              await audit(cwd, { tool: "edit", filePath });
              return out;
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
  };

  const result = streamText({
    model: getModel(),
    system: mode === "plan" ? SYSTEM_AR + "\nوضع PLAN: اعرض الخطة فقط، لا تستخدم edit/run." : SYSTEM_AR,
    prompt,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
  });

  let full = "";
  for await (const delta of result.textStream) {
    full += delta;
    onText?.(delta);
  }
  // استهلاك كامل للستريم يضمن انتهاء كل خطوات الأدوات (stopWhen)
  const settled = result as unknown as { finishReason?: Promise<unknown> };
  await settled.finishReason?.catch(() => undefined);
  await audit(cwd, { tool: "done", mode, chars: full.length });
  return full;
}
