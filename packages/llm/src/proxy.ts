// وكيل OpenAI-compatible عام (AIClient-2-API / LiteLLM / أي مجمّع محلي).
// الأداة الخارجية تشتغل كعملية منفصلة — لا كود منها هنا (رخصة GPL-3.0).
export interface ProxyConfig {
  baseURL: string;
  apiKey: string;
  models: string[];
}

export function proxyConfig(): ProxyConfig | undefined {
  const provider = (process.env.METWILY_PROVIDER ?? "").trim().toLowerCase();
  const url = (process.env.METWILY_PROXY_URL ?? "").trim();
  if (provider !== "proxy" && !url) return undefined;
  const baseURL = (url || "http://127.0.0.1:3000/v1").replace(/\/+$/, "");
  // AIClient-2-API الافتراضي 123456؛ LiteLLM/Ollama يتجاهلان القيمة.
  const apiKey = (process.env.METWILY_PROXY_KEY ?? "123456").trim();
  const list = (process.env.METWILY_PROXY_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const single = (process.env.METWILY_MODEL ?? "").trim();
  const models = list.length > 0 ? list : single ? [single] : [];
  return { baseURL, apiKey, models };
}

async function getJson(url: string, apiKey?: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function listProxyModels(cfg = proxyConfig()): Promise<string[]> {
  if (!cfg) return [];
  const data = (await getJson(`${cfg.baseURL}/models`, cfg.apiKey)) as { data?: Array<{ id?: string }> };
  return (data.data ?? []).map((m) => m.id ?? "").filter(Boolean);
}

export async function listOllamaModels(): Promise<string[]> {
  const base = (process.env.AGENT_LLM_URL ?? "http://127.0.0.1:11434/v1").replace(/\/v1\/?$/, "");
  const data = (await getJson(`${base}/api/tags`)) as { models?: Array<{ name?: string }> };
  return (data.models ?? []).map((m) => m.name ?? "").filter(Boolean);
}
