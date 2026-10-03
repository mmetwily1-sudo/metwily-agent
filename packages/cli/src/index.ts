#!/usr/bin/env node
// metwily CLI — binary: metwily (commander + streaming)
import { createInterface } from "node:readline";
import { Command } from "commander";
import { loadHistory, runAgent } from "@metwily/core/index.js";
import { detectIntent } from "@metwily/llm/intent.js";

// درس opencode: تأكيد بشري قبل التنفيذ في وضع build (طبقة permission خفيفة).
async function confirmBuild(): Promise<boolean> {
  if (process.env.METWILY_YES === "1") return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question("وضع build سينفذ تعديلات وأوامر — متابعة؟ [y/N] ", resolve);
  });
  rl.close();
  return /^(y|نعم|ايوه|أيوه)/i.test(answer.trim());
}

const program = new Command();
program.name("metwily").description("متولي — Arabic-first coding agent").version("0.1.0");

program
  .argument("[prompt]", "الأمر أو النية (عربي أو إنجليزي)")
  .option("--plan", "عرض الخطة فقط بدون تنفيذ (read/search فقط)")
  .option("--resume", "إكمال آخر جلسة")
  .option("--no-commit", "تعطيل الـ auto-commit لهذه الجلسة")
  .option("-C, --cwd <dir>", "مجلد العمل", process.cwd())
  .action(async (prompt: string | undefined, opts: { plan?: boolean; resume?: boolean; commit?: boolean; cwd: string }) => {
    if (opts.resume) {
      const history = await loadHistory(opts.cwd);
      if (history.length === 0) {
        console.log("لا توجد جلسة سابقة في .metwily/state.json");
        return;
      }
      const last = history.slice(-2);
      console.log("آخر تبادل في الجلسة:");
      for (const m of last) console.log(`\n### ${m.role}\n${m.content.slice(0, 800)}`);
      console.log('\nاكتب prompt جديد وسيُكمل بنفس السياق — مثال: metwily "كمّل"');
      return;
    }
    if (!prompt) {
      console.log("استخدم: metwily \"زود صفحة تسعير\" أو metwily --plan \"ابني SaaS\"");
      return;
    }
    const intent = detectIntent(prompt);
    const mode = opts.plan || intent === "plan" ? "plan" : "build";
    if (mode === "plan") console.log("[plan] وضع الخطة — أدوات القراءة فقط.\n");
    if (mode === "build" && !(await confirmBuild())) {
      console.log("تم الإلغاء — لم يُنفذ شيء.");
      return;
    }
    try {
      const out = await runAgent(prompt, {
        cwd: opts.cwd,
        mode,
        autoCommit: opts.commit === false ? false : undefined,
        onText: (d: string) => process.stdout.write(d),
      });
      void out;
      process.stdout.write("\n");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("DEEPSEEK_API_KEY")) {
        console.error("\n⚠️ " + msg);
        console.error("شغّل: set DEEPSEEK_API_KEY=sk-... (أو ضعه في .env)");
      } else if (/402|Insufficient Balance/i.test(msg)) {
        console.error("\n⚠️ رصيد DeepSeek خلص (Insufficient Balance).");
        console.error("اشحن من: https://platform.deepseek.com — دولار واحد يكفي تجارب كتير.");
      } else if (/401|invalid.*key|unauthorized/i.test(msg)) {
        console.error("\n⚠️ المفتاح مرفوض (401) — تأكد من DEEPSEEK_API_KEY.");
      } else if (/429|quota|rate.?limit|resource.?exhausted/i.test(msg)) {
        console.error("\n⚠️ حصة Gemini المجانية خلصت مؤقتاً (429) — انتظر دقيقة أو بدّل المفتاح (GEMINI_API_KEY_2).");
      } else {
        console.error("\n❌ خطأ: " + msg.slice(0, 300));
      }
      process.exitCode = 1;
    }
  });

program.parse();
