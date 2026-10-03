// @metwily/llm/costs — عدّاد التكلفة: توكن → دولار تقريبي.
// الأسعار تقديرية (2026) وقابلة للتحديث — الدقة في التوكن مضمونة، الدولار تقريبي.
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// $ لكل مليون توكن (in/out). null = مجاني/غير معروف → التكلفة n/a.
const PRICES: Record<string, { input: number; output: number } | null> = {
  "deepseek-chat": { input: 0.27, output: 1.1 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
  "gemini-3.8-flash": null, // الحصة المجانية — التكلفة الحقيقية = 0 حتى نفادها
};

export function normalizeModel(label: string): string {
  for (const known of Object.keys(PRICES)) {
    if (label.includes(known)) return known;
  }
  return label;
}

export interface CostReport {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number | null;
}

export function costOf(label: string, usage: TokenUsage): CostReport {
  const model = normalizeModel(label);
  const rate = PRICES[model] ?? null;
  const total = usage.inputTokens + usage.outputTokens;
  return {
    model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: total,
    costUsd: rate ? (usage.inputTokens * rate.input + usage.outputTokens * rate.output) / 1_000_000 : null,
  };
}

export function formatCost(r: CostReport): string {
  const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);
  const cost = r.costUsd === null ? "مجاناً (حصة مجانية)" : `≈ $${r.costUsd.toFixed(4)}`;
  return `التوكن: ${k(r.inputTokens)} in / ${k(r.outputTokens)} out — التكلفة: ${cost}`;
}
