// @metwily/llm/intent — ترجمة النية العربية إلى intent إنجليزي داخلي
// "نفّذ" → implement, "صلّح البج" → fix, "اشرح" → explain
export type Intent = "implement" | "fix" | "explain" | "plan" | "unknown";

const AR_MAP: Array<[RegExp, Intent]> = [
  [/نفذ|اعمل|زود|ابني|ضيف/i, "implement"],
  [/صلح|بج|عطل|خطأ|مش شغال/i, "fix"],
  [/اشرح|فهم|ليه/i, "explain"],
  [/خطة|اقترح/i, "plan"],
];

export function detectIntent(prompt: string): Intent {
  for (const [re, intent] of AR_MAP) if (re.test(prompt)) return intent;
  return "unknown";
}
