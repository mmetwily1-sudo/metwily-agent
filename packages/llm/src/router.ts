// @metwily/llm/router — Vercel AI SDK + DeepSeek (OpenAI-compatible)
// الشرح مصري، الكود إنجليزي. النية العربية تترجم لـ intent داخلي.
import { deepseek } from "@ai-sdk/deepseek";
import type { LanguageModel } from "ai";
import { loadConfig } from "@metwily/tools/config.js";

export const SYSTEM_AR = `أنت "متولي" — coding agent عربي أولاً.
- اشرح والخطط بالمصري المختصر. الكود والكوميت بالإنجليزية.
- القواعد الإجبارية: read قبل أي edit لنفس الملف. تعديلات صغيرة atomic.
- لا تدّعي قراءة ملف بدون tool. أي ادعاء عن كود لازم file:line.
- بعد أي edit لازم check (typecheck/test) أخضر قبل done.
- المخرجات الطويلة لخصها. لا تعيد كتابة ملف كامل — استخدم edit دقيق.`;

export type ModelId = "deepseek-chat" | "deepseek-reasoner";

export async function getModelId(cwd = process.cwd()): Promise<ModelId> {
  const env = (process.env.METWILY_MODEL ?? "").trim();
  if (env === "deepseek-reasoner" || env === "deepseek-chat") return env;
  return (await loadConfig(cwd)).model;
}

export function requireApiKey(): string {
  const key = (process.env.DEEPSEEK_API_KEY ?? "").trim();
  if (!key) {
    throw new Error(
      "ناقص DEEPSEEK_API_KEY — حطه في .env أو env vars. هاته من https://platform.deepseek.com/api_keys"
    );
  }
  return key;
}

export async function getModel(cwd = process.cwd()): Promise<LanguageModel> {
  requireApiKey(); // الـ SDK يقرأ DEEPSEEK_API_KEY من البيئة
  return deepseek(await getModelId(cwd));
}

export * from "./intent.js";
