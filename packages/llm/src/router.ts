// @metwily/llm/router â€” Vercel AI SDK + DeepSeek (OpenAI-compatible)
// Ø§Ù„Ø´Ø±Ø­ Ù…ØµØ±ÙŠØŒ Ø§Ù„ÙƒÙˆØ¯ Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠ. Ø§Ù„Ù†ÙŠØ© Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© ØªØªØ±Ø¬Ù… Ù„Ù€ intent Ø¯Ø§Ø®Ù„ÙŠ.
import { deepseek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { loadConfig } from "@metwily/tools/config.js";
import { echoModel } from "./echo.js";
import { proxyConfig } from "./proxy.js";

// Ø¯Ø±Ø³ Ø§Ù„Ù…Ø¹Ø±ÙØ©: Ù…ÙØªØ§Ø­Ø§ Gemini Ø¨ØªÙ†Ø§ÙˆØ¨ (GEMINI_API_KEY + GEMINI_API_KEY_2)
// Ù„Ø£Ù† Ø§Ù„Ø­ØµØ© Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠØ© Ù‡ÙŠ Ø¹Ù†Ù‚ Ø§Ù„Ø²Ø¬Ø§Ø¬Ø© â€” Ø§Ù„ØªÙ†Ø§ÙˆØ¨ Ù…Ø°ÙƒÙˆØ± ÙÙŠ vision.ts Ù„Ù…Ù†Ø§Ø±Ø©.

export const SYSTEM_AR = `Ø£Ù†Øª "Ù…ØªÙˆÙ„ÙŠ" â€” coding agent Ø¹Ø±Ø¨ÙŠ Ø£ÙˆÙ„Ø§Ù‹.
- Ø§Ø´Ø±Ø­ ÙˆØ§Ù„Ø®Ø·Ø· Ø¨Ø§Ù„Ù…ØµØ±ÙŠ Ø§Ù„Ù…Ø®ØªØµØ±. Ø§Ù„ÙƒÙˆØ¯ ÙˆØ§Ù„ÙƒÙˆÙ…ÙŠØª Ø¨Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ©.
- Ø§Ù„Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„Ø¥Ø¬Ø¨Ø§Ø±ÙŠØ©: read Ù‚Ø¨Ù„ Ø£ÙŠ edit Ù„Ù†ÙØ³ Ø§Ù„Ù…Ù„Ù. ØªØ¹Ø¯ÙŠÙ„Ø§Øª ØµØºÙŠØ±Ø© atomic.
- Ù„Ø§ ØªØ¯Ù‘Ø¹ÙŠ Ù‚Ø±Ø§Ø¡Ø© Ù…Ù„Ù Ø¨Ø¯ÙˆÙ† tool. Ø£ÙŠ Ø§Ø¯Ø¹Ø§Ø¡ Ø¹Ù† ÙƒÙˆØ¯ Ù„Ø§Ø²Ù… file:line.
- Ø¨Ø¹Ø¯ Ø£ÙŠ edit Ù„Ø§Ø²Ù… check (typecheck/test) Ø£Ø®Ø¶Ø± Ù‚Ø¨Ù„ done.
- Ø§Ù„Ù…Ø®Ø±Ø¬Ø§Øª Ø§Ù„Ø·ÙˆÙŠÙ„Ø© Ù„Ø®ØµÙ‡Ø§. Ù„Ø§ ØªØ¹ÙŠØ¯ ÙƒØªØ§Ø¨Ø© Ù…Ù„Ù ÙƒØ§Ù…Ù„ â€” Ø§Ø³ØªØ®Ø¯Ù… edit Ø¯Ù‚ÙŠÙ‚.
- Ø¯Ø±ÙˆØ³ Ù…ÙŠØ¯Ø§Ù†ÙŠØ©: Ù„Ø§ ØªÙƒØ±Ø± Ù†ÙØ³ Ø§Ø³ØªØ¯Ø¹Ø§Ø¡ Ø§Ù„Ø£Ø¯Ø§Ø© (Ø¥Ù† ÙØ´Ù„ Ø§Ù‚Ø±Ø£ Ø§Ù„Ø®Ø·Ø£ ÙˆØºÙŠÙ‘Ø±). Ø§Ø¨Ø¯Ø£ Ø¨Ù€ map
  Ø«Ù… read Ù„Ù„Ù…Ù„Ù Ø§Ù„Ù…Ø³ØªÙ‡Ø¯Ù Ø«Ù… edit Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø© Ø«Ù… check. Ø§Ù„ÙƒÙ„Ø§Ù… Ø§Ù„ÙƒØ«ÙŠØ± Ù„ÙŠØ³ Ø¥Ù†Ø¬Ø§Ø²Ø§Ù‹ â€”
  Ø§Ù„Ø¥Ù†Ø¬Ø§Ø² = Ø§Ø³ØªØ¯Ø¹Ø§Ø¡Ø§Øª Ø£Ø¯ÙˆØ§Øª ØµØ­ÙŠØ­Ø© Ù…ØªØªØ§Ù„ÙŠØ©.`;

export type ModelId = "deepseek-chat" | "deepseek-reasoner";

// Ollama Ù…Ø­Ù„ÙŠ (Ù†ÙØ³ Ø§ØªÙØ§Ù‚ÙŠØ© Ù…Ù†Ø§Ø±Ø©: AGENT_LLM_URL + AGENT_LLM_MODEL).
// Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠ Ù…Ø­Ù„ÙŠ Ø£ÙˆÙ„Ø§Ù‹: Ù„Ùˆ Ollama Ø´ØºØ§Ù„ Ù†Ø³ØªØ®Ø¯Ù…Ù‡ Ù‚Ø¨Ù„ Ø£ÙŠ Ø³Ø­Ø§Ø¨Ø©.
export interface OllamaConfig {
  baseURL: string;
  model: string;
}

function providerName(): string {
  return (process.env.METWILY_PROVIDER ?? "").trim().toLowerCase();
}

export function localOnly(): boolean {
  const p = providerName();
  return p === "ollama" || p === "local";
}

export function ollamaBaseUrl(): string {
  return (process.env.AGENT_LLM_URL ?? "http://127.0.0.1:11434/v1").trim();
}

export async function isOllamaReachable(timeoutMs = 2000): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${ollamaBaseUrl().replace(/\/v1\/?$/, "")}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

// Ø£ÙØ¶Ù„ÙŠØ© Ø§Ù„Ù…ÙˆØ¯ÙŠÙ„ Ø§Ù„Ù…Ø­Ù„ÙŠ: Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ù…Ø¶Ø¨ÙˆØ·Ø© Ø£ÙˆÙ„Ø§Ù‹ Ø«Ù… coder Ø«Ù… Ø£ÙŠ Ù…ÙˆØ¯ÙŠÙ„ Ù…Ø«Ø¨Øª.
const LOCAL_PREFERENCE = [
  "metwily-local",
  "qwen3:1.7b",
  "qwen3:4b",
  "qwen2.5:3b",
  "qwen2.5:1.5b",
  "llama3.2:3b",
  "qwen2.5-coder:3b",
];

export async function pickLocalModel(): Promise<string> {
  const env = (process.env.METWILY_OLLAMA_MODEL ?? process.env.AGENT_LLM_MODEL ?? "").trim();
  if (env) return env;
  try {
    const res = await fetch(`${ollamaBaseUrl().replace(/\/v1\/?$/, "")}/api/tags`);
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const names = (data.models ?? []).map((m) => m.name);
    for (const pref of LOCAL_PREFERENCE) {
      const hit = names.find((n) => n === pref || n.startsWith(pref + ":"));
      if (hit) return hit;
    }
    if (names.length > 0) return names[0];
  } catch {
    // ØªØ¬Ø§Ù‡Ù„ â€” Ù†Ø±Ø¬Ø¹ Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠ
  }
  return "qwen3:1.7b";
}

export async function ollamaConfig(): Promise<OllamaConfig | undefined> {
  const p = providerName();
  const wanted = p === "" || p === "ollama" || p === "local" || Boolean(process.env.AGENT_LLM_URL);
  if (!wanted) return undefined;
  if (!(await isOllamaReachable())) return undefined;
  return { baseURL: ollamaBaseUrl(), model: await pickLocalModel() };
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
  // GEMINI_API_KEY Ø«Ù… _2 .. _9 (Ù†ÙØ³ Ø§ØªÙØ§Ù‚ÙŠØ© Ù…Ù†Ø§Ø±Ø©ØŒ Ù…ÙˆØ³Ø¹Ø© Ù„Ø³ØªØ© Ù…ÙØ§ØªÙŠØ­)
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
  const proxy = proxyConfig();
  if (proxy) return proxy.apiKey;
  throw new Error(
    "Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù…Ø²ÙˆØ¯ Ù…ØªØ§Ø­: Ø´ØºÙ‘Ù„ Ollama Ù…Ø­Ù„ÙŠØ§Ù‹ (ollama serve) Ø£Ùˆ Ø¶Ø¹ DEEPSEEK_API_KEY/GEMINI_API_KEYØŒ Ø£Ùˆ Ø´ØºÙ‘Ù„ Ø¨Ø±ÙˆÙƒØ³ÙŠ ÙˆØ§Ø¶Ø¨Ø· METWILY_PROXY_URL",
  );
}

// Ø§Ù„ØªÙ†Ø§ÙˆØ¨: Ù…ÙØªØ§Ø­ Gemini Ø±Ù‚Ù… N (Ù„ØªØ¬Ø§ÙˆØ² Ø­Ø¯ÙˆØ¯ Ø§Ù„Ø­ØµØ© â€” Ù†ÙØ³ Ù†Ù‡Ø¬ Ù…Ù†Ø§Ø±Ø©).
export function geminiKeyAt(index: number): string | undefined {
  const keys = geminiKeys();
  if (keys.length === 0) return undefined;
  return keys[index % keys.length];
}

// Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…Ø±Ø´Ø­ÙŠÙ†: echo â† Ø§Ù„Ø¨Ø±ÙˆÙƒØ³ÙŠ (Ø¥Ù† Ø§Ø®ØªÙŠØ±) â† Ollama Ù…Ø­Ù„ÙŠ â† deepseek â† Gemini â† Ø§Ù„Ø¨ÙˆØ§Ø¨Ø©.
// Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠ Ù…Ø­Ù„ÙŠ Ø£ÙˆÙ„Ø§Ù‹: Ù„Ùˆ Ollama Ø´ØºØ§Ù„ ÙŠØ³ØªØ®Ø¯Ù…Ù‡ Ù‚Ø¨Ù„ Ø§Ù„Ø³Ø­Ø§Ø¨Ø©ØŒ Ù…Ø¹ fallback Ù„Ùˆ Ø§Ù„Ù…ÙØªØ§Ø­ Ù…ÙˆØ¬ÙˆØ¯.
// Ø¯Ø±Ø³ Ø§Ù„Ù…Ø¹Ø±ÙØ© (ai-agent-learning.md): Ø¨ÙˆØ§Ø¨Ø© OpenAI Ø§Ù„Ù…ØªÙˆØ§ÙÙ‚Ø© Ù„Ù€Gemini (/v1beta/openai)
// Ù„Ù‡Ø§ Ø­ØµØ© Ù…Ø³ØªÙ‚Ù„Ø© â€” ØªØ¹Ù…Ù„ Ø¹Ù†Ø¯Ù…Ø§ ØªÙ…ÙˆØª :generateContent.
export async function getCandidateModels(cwd = process.cwd()): Promise<Array<{ label: string; model: LanguageModel }>> {
  const provider = providerName();
  if (provider === "echo") {
    return [{ label: "echo/demo", model: echoModel() }];
  }
  const out: Array<{ label: string; model: LanguageModel }> = [];
  // Ø§Ù„Ø¨Ø±ÙˆÙƒØ³ÙŠ Ø§Ù„Ù…Ø­Ù„ÙŠ (AIClient-2-API ÙˆØ£Ù…Ø«Ø§Ù„Ù‡): Ù…ÙˆØ¯ÙŠÙ„Ø§Øª Ù…ØªØ¹Ø¯Ø¯Ø© ÙˆØ§Ø®ØªÙŠØ§Ø± Ø¹Ø¨Ø± --model.
  const proxy = proxyConfig();
  if (proxy) {
    const proxyProvider = createOpenAICompatible({
      name: "metwily-proxy",
      apiKey: proxy.apiKey,
      baseURL: proxy.baseURL,
    });
    for (const m of proxy.models.length > 0 ? proxy.models : ["default"]) {
      out.push({ label: `proxy/${m}`, model: proxyProvider(m) });
    }
    if (provider === "proxy") return out;
  }
  // Ollama Ø§Ù„Ù…Ø­Ù„ÙŠ: Ù…ØªØ§Ø­ Ø§ÙØªØ±Ø§Ø¶ÙŠØ§Ù‹ Ù„Ùˆ Ø´ØºØ§Ù„ â€” Ø£Ùˆ Ø¥Ø¬Ø¨Ø§Ø±ÙŠ Ø¹Ù†Ø¯ METWILY_PROVIDER=ollama/local.
  const ollama = await ollamaConfig();
  if (ollama) {
    const local = createOpenAICompatible({ name: "ollama-local", baseURL: ollama.baseURL });
    out.push({ label: `ollama/${ollama.model}`, model: local(ollama.model) });
    if (localOnly()) return out;
  }
  if (deepseekKey()) {
    const id = await getModelId(cwd);
    out.push({ label: `deepseek/${id}`, model: deepseek(id) });
  }
  const keys = geminiKeys();
  if (keys.length > 0) {
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
  }
  if (out.length === 0) {
    requireApiKey();
    throw new Error("unreachable");
  }
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
