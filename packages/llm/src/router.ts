// @metwily/llm/router — Vercel AI SDK + DeepSeek (OpenAI-compatible)
// الشرح مصري، الكود إنجليزي. النية العربية تترجم لـ intent داخلي.
import { deepseek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { loadConfig } from "@metwily/tools/config.js";

// درس المعرفة: مفتاحا Gemini بتناوب (GEMINI_API_KEY + GEMINI_API_KEY_2)
// لأن الحصة المجانية هي عنق الزجاجة — التناوب مذكور في vision.ts لمنارة.

export const SYSTEM_AR = `أنت "متولي" — coding agent عربي أولاً.
- اشرح والخطط بالمصري المختصر. الكود والكوميت بالإنجليزية.
- القواعد الإجبارية: read قبل أي edit لنفس الملف. تعديلات صغيرة atomic.
- لا تدّعي قراءة ملف بدون tool. أي ادعاء عن كود لازم file:line.
- بعد أي edit لازم check (typecheck/test) أخضر قبل done.
- المخرجات الطويلة لخصها. لا تعيد كتابة ملف كامل — استخدم edit دقيق.
- دروس ميدانية: لا تكرر نفس استدعاء الأداة (إن فشل اقرأ الخطأ وغيّر). ابدأ بـ map
  ثم read للملف المستهدف ثم edit مرة واحدة ثم check. الكلام الكثير ليس إنجازاً —
  الإنجاز = استدعاءات أدوات صحيحة متتالية.`;

export type ModelId = "deepseek-chat" | "deepseek-reasoner";

// Ollama محلي (نفس اتفاقية منارة: AGENT_LLM_URL + AGENT_LLM_MODEL).
// يُفعّل فقط عند ضبط METWILY_PROVIDER=ollama — لا يغيّر السلوك الافتراضي.
export interface OllamaConfig {
  baseURL: string;
  model: string;
}

export function ollamaConfig(): OllamaConfig | undefined {
  if ((process.env.METWILY_PROVIDER ?? "").trim().toLowerCase() !== "ollama" && !process.env.AGENT_LLM_URL) {
    return undefined;
  }
  return {
    baseURL: (process.env.AGENT_LLM_URL ?? "http://127.0.0.1:11434/v1").trim(),
    model: (process.env.METWILY_OLLAMA_MODEL ?? process.env.AGENT_LLM_MODEL ?? "qwen2.5:3b").trim(),
  };
}

export async function getModelId(cwd = process.cwd()): Promise<ModelId> {
  const env = (process.env.METWILY_MODEL ?? "").trim();
  if (env === "deepseek-reasoner" || env === "deepseek-chat") return env;
  return (await loadConfig(cwd)).model;
}

export function deepseekKey(): string {
  return (process.env.DEEPSEEK_API_KEY ?? "").trim();
}

export function geminiKeys(): string[] {
  // GEMINI_API_KEY ثم _2 .. _9 (نفس اتفاقية منارة، موسعة لستة مفاتيح)
  const out: string[] = [];
  for (let i = 0; i <= 9; i++) {
    const name = i === 0 ? "GEMINI_API_KEY" : `GEMINI_API_KEY_${i}`;
    const v = (process.env[name] ?? "").trim();
    if (v) out.push(v);
  }
  return out;
}

export function requireApiKey(): string {
  if (deepseekKey()) return deepseekKey();
  const g = geminiKeys();
  if (g.length > 0) return g[0];
  throw new Error("لا يوجد مفتاح: ضع DEEPSEEK_API_KEY (مدفوع) أو GEMINI_API_KEY (مجاني من aistudio.google.com)");
}

// التناوب: مفتاح Gemini رقم N (لتجاوز حدود الحصة — نفس نهج منارة).
export function geminiKeyAt(index: number): string | undefined {
  const keys = geminiKeys();
  if (keys.length === 0) return undefined;
  return keys[index % keys.length];
}

// قائمة المرشحين بالترتيب: deepseek المدفوع ← ollama المحلي (إن ضُبط) ← مفاتيح Gemini ← البوابة البديلة.
// درس المعرفة (ai-agent-learning.md): بوابة OpenAI المتوافقة لـGemini (/v1beta/openai)
// لها حصة مستقلة — تعمل عندما تموت :generateContent.
export async function getCandidateModels(cwd = process.cwd()): Promise<Array<{ label: string; model: LanguageModel }>> {
  if (deepseekKey()) {
    const id = await getModelId(cwd);
    return [{ label: `deepseek/${id}`, model: deepseek(id) }];
  }
  const out: Array<{ label: string; model: LanguageModel }> = [];
  const ollama = ollamaConfig();
  if (ollama) {
    const local = createOpenAICompatible({ name: "ollama-local", baseURL: ollama.baseURL });
    out.push({ label: `ollama/${ollama.model}`, model: local(ollama.model) });
  }
  const keys = geminiKeys();
  if (keys.length === 0 && out.length === 0) {
    requireApiKey();
    throw new Error("unreachable");
  }
  const geminiModel = (process.env.METWILY_GEMINI_MODEL ?? "gemini-3.8-flash").trim();
  keys.forEach((apiKey, i) => {
    out.push({ label: `gemini/${geminiModel}#${i + 1}`, model: createGoogleGenerativeAI({ apiKey })(geminiModel) });
  });
  const gw = createOpenAICompatible({
    name: "gemini-openai-gateway",
    apiKey: keys[keys.length - 1],
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
  out.push({ label: `gemini-gateway/${geminiModel}`, model: gw(geminiModel) });
  return out;
}

export async function getModel(cwd = process.cwd()): Promise<LanguageModel> {
  return (await getCandidateModels(cwd))[0].model;
}

export function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /429|503|quota|rate.?limit|resource.?exhausted|unavailable|high demand|overloaded/i.test(msg);
}

export * from "./intent.js";
