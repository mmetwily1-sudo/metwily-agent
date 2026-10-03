// @metwily/llm/router — Vercel AI SDK + DeepSeek (OpenAI-compatible)
// الشرح مصري، الكود إنجليزي. النية العربية تترجم لـ intent داخلي.
import { deepseek } from "@ai-sdk/deepseek";
import type { LanguageModel } from "ai";

export const SYSTEM_AR = `أنت "متولي" — coding agent عربي أولاً.
- اشرح والخطط بالمصري المختصر. الكود والكوميت بالإنجليزية.
- القواعد الإجبارية: read قبل أي edit لنفس الملف. تعديلات صغيرة atomic.
- لا تدّعي قراءة ملف بدون tool. أي ادعاء عن كود لازم file:line.
- بعد أي edit لازم check (typecheck/test) أخضر قبل done.
- المخرجات الطويلة لخصها. لا تعيد كتابة ملف كامل — استخدم edit دقيق.`;

export type ModelId = "deepseek-chat" | "deepseek-reasoner";

export function getModelId(): ModelId {
  const m = (process.env.METWILY_MODEL ?? "deepseek-chat").trim();
  return m === "deepseek-reasoner" ? "deepseek-reasoner" : "deepseek-chat";
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

export function getModel(): LanguageModel {
  requireApiKey(); // الـ SDK يقرأ DEEPSEEK_API_KEY من البيئة
  return deepseek(getModelId());
}

export * from "./intent.js";
