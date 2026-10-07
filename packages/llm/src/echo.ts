// @metwily/llm/echo — عقل وهمي حتمي لاختبار الـ loop كاملاً بدون حصة.
// يقرأ سيناريو من METWILY_ECHO_SCRIPT (JSON) أو يستخدم Demo افتراضياً.
// كل خطوة: { say } رد نصي | { call: { name, input } } استدعاء أداة.
// مبني على LanguageModelV3 (الأصلي في ai v6 — وضع v2 التوافقي يكسر الأدوات).
import type {
  LanguageModelV3,
  LanguageModelV3Content,
  LanguageModelV3FinishReason,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from "@ai-sdk/provider";

const USAGE: LanguageModelV3Usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

const finish = (unified: LanguageModelV3FinishReason["unified"]): LanguageModelV3StreamPart => ({
  type: "finish",
  finishReason: { unified, raw: unified },
  usage: USAGE,
});

export type EchoStep =
  | { say: string }
  | { call: { name: string; input: Record<string, unknown> } };

const DEFAULT_SCRIPT: EchoStep[] = [
  { call: { name: "map", input: {} } },
  { call: { name: "read", input: { filePath: "package.json", offset: 1, limit: 5 } } },
  { say: "الخريطة والقراءة تعملان — حلقة متولي سليمة end-to-end." },
];

export function loadEchoScript(): EchoStep[] {
  const raw = (process.env.METWILY_ECHO_SCRIPT ?? "").trim();
  if (!raw) return DEFAULT_SCRIPT;
  try {
    const parsed = JSON.parse(raw) as EchoStep[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // سيناريو مكسور — الافتراضي
  }
  return DEFAULT_SCRIPT;
}

function streamParts(step: EchoStep, id: string): LanguageModelV3StreamPart[] {
  const head: LanguageModelV3StreamPart[] = [{ type: "stream-start", warnings: [] }];
  if ("say" in step) {
    return [
      ...head,
      { type: "text-start", id: `${id}-t` },
      { type: "text-delta", id: `${id}-t`, delta: step.say },
      { type: "text-end", id: `${id}-t` },
      finish("stop"),
    ];
  }
  return [
    ...head,
    {
      type: "tool-call",
      toolCallId: id,
      toolName: step.call.name,
      input: JSON.stringify(step.call.input),
    },
    finish("tool-calls"),
  ];
}

export function echoModel(steps: EchoStep[] = loadEchoScript()): LanguageModelV3 {
  let cursor = 0;
  const next = (): EchoStep => {
    const step = steps[Math.min(cursor, steps.length - 1)];
    cursor++;
    return step;
  };
  let callSeq = 0;

  return {
    specificationVersion: "v3",
    provider: "metwily-echo",
    modelId: "echo-demo",
    supportedUrls: {},
    async doGenerate() {
      const step = next();
      let content: LanguageModelV3Content[];
      let finishReason: LanguageModelV3FinishReason;
      if ("say" in step) {
        content = [{ type: "text", text: step.say }];
        finishReason = { unified: "stop", raw: "stop" };
      } else {
        content = [
          {
            type: "tool-call",
            toolCallId: `echo-${++callSeq}`,
            toolName: step.call.name,
            input: JSON.stringify(step.call.input),
          },
        ];
        finishReason = { unified: "tool-calls", raw: "tool-calls" };
      }
      return { content, finishReason, usage: USAGE, warnings: [] };
    },
    async doStream() {
      const step = next();
      const parts = streamParts(step, `echo-${++callSeq}`);
      return {
        stream: new ReadableStream<LanguageModelV3StreamPart>({
          start(controller) {
            for (const p of parts) controller.enqueue(p);
            controller.close();
          },
        }),
      };
    },
  };
}
