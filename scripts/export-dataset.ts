// scripts/export-dataset.mts — الخطوة الأولى نحو ذكاء خاص: تحويل سجلات متولي
// (state.json + audit.log.jsonl) إلى dataset بصيغة OpenAI FT JSONL (الأفضل للأدوات
// حسب مجلس الخبراء: tool_calls أصلية، لا ShareGPT/Alpaca).
// + تنقية الأسرار (redaction) + إحصاءات. يُستخدم: tsx scripts/export-dataset.mts [cwd]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface FTMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
}

export interface FTExample {
  messages: FTMessage[];
}

export interface ExportStats {
  conversations: number;
  toolEvents: number;
  redacted: number;
  skipped: number;
}

const SECRET_RES = [
  /sk-[A-Za-z0-9_-]{8,}/g,
  /AQ\.[A-Za-z0-9_-]{8,}/g,
  /AIza[A-Za-z0-9_-]{8,}/g,
  /Bearer\s+[A-Za-z0-9._~-]{8,}/g,
  /egy_(sk|pk)_[A-Za-z0-9_-]{6,}/g,
  /re_[A-Za-z0-9_-]{6,}/g,
];

export function redact(text: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  for (const re of SECRET_RES) {
    re.lastIndex = 0;
    out = out.replace(re, () => {
      count++;
      return "<REDACTED>";
    });
  }
  return { text: out, count };
}

const SYSTEM_SHORT =
  'أنت "متولي" — coding agent عربي أولاً. القواعد: read قبل أي edit، تعديلات صغيرة، لا تدّعي قراءة ملف بدون أداة، وبعد أي edit لازم check أخضر.';

export async function exportDataset(cwd: string, outDir: string): Promise<ExportStats> {
  const stats: ExportStats = { conversations: 0, toolEvents: 0, redacted: 0, skipped: 0 };
  const examples: FTExample[] = [];

  // 1. المحادثات من state.json (user ↔ assistant حقيقية)
  const stateRaw = await readFile(path.join(cwd, ".metwily", "state.json"), "utf8").catch(() => "");
  if (stateRaw) {
    try {
      const state = JSON.parse(stateRaw) as { messages?: Array<{ role: string; content: string }> };
      const msgs = Array.isArray(state.messages) ? state.messages : [];
      for (let i = 0; i + 1 < msgs.length; i += 2) {
        const u = msgs[i];
        const a = msgs[i + 1];
        if (u?.role !== "user" || a?.role !== "assistant" || !u.content?.trim() || !a.content?.trim()) {
          stats.skipped++;
          continue;
        }
        const ru = redact(u.content);
        const ra = redact(a.content);
        stats.redacted += ru.count + ra.count;
        examples.push({ messages: [{ role: "system", content: SYSTEM_SHORT }, { role: "user", content: ru.text }, { role: "assistant", content: ra.text }] });
        stats.conversations++;
      }
    } catch {
      // state مكسور — يُتجاهل
    }
  }

  // 2. أحداث الأدوات من audit.log.jsonl (تُحفظ كسجلات مسار خام للربط المستقبلي عبر session)
  const auditRaw = await readFile(path.join(cwd, ".metwily", "audit.log.jsonl"), "utf8").catch(() => "");
  const toolTrail: Array<Record<string, unknown>> = [];
  if (auditRaw) {
    for (const line of auditRaw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const entry = JSON.parse(t) as Record<string, unknown>;
        if (typeof entry.tool === "string" && entry.tool !== "done" && entry.tool !== "usage") {
          const r = redact(JSON.stringify(entry));
          stats.redacted += r.count;
          stats.toolEvents++;
          toolTrail.push(JSON.parse(r.text) as Record<string, unknown>);
        }
      } catch {
        stats.skipped++;
      }
    }
  }

  await mkdir(outDir, { recursive: true }).catch(() => {});
  await writeFile(
    path.join(outDir, "conversations.jsonl"),
    examples.map((e) => JSON.stringify(e)).join("\n"),
    "utf8"
  );
  await writeFile(path.join(outDir, "tool-trail.jsonl"), toolTrail.map((t) => JSON.stringify(t)).join("\n"), "utf8");
  await writeFile(path.join(outDir, "STATS.json"), JSON.stringify({ ...stats, at: new Date().toISOString() }, null, 2), "utf8");
  return stats;
}

const target = process.argv[2] ?? process.cwd();
const out = path.join(target, ".metwily", "dataset");
exportDataset(target, out).then((s) => {
  console.log(`dataset: ${s.conversations} محادثة + ${s.toolEvents} حدث أدوات → ${out} (redacted=${s.redacted} skipped=${s.skipped})`);
});
