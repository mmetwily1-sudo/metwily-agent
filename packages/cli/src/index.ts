#!/usr/bin/env node
// metwily CLI — binary: metwily (commander + streaming)
import { Command } from "commander";
import { runAgent } from "@metwily/core/index.js";
import { detectIntent } from "@metwily/llm/intent.js";

const program = new Command();
program.name("metwily").description("متولي — Arabic-first coding agent").version("0.1.0");

program
  .argument("[prompt]", "الأمر أو النية (عربي أو إنجليزي)")
  .option("--plan", "عرض الخطة فقط بدون تنفيذ (read/search فقط)")
  .option("--resume", "إكمال آخر جلسة")
  .option("-C, --cwd <dir>", "مجلد العمل", process.cwd())
  .action(async (prompt: string | undefined, opts: { plan?: boolean; resume?: boolean; cwd: string }) => {
    if (opts.resume) {
      console.log("استئناف آخر جلسة من .metwily/state.json ... (قريباً)");
      return;
    }
    if (!prompt) {
      console.log("استخدم: metwily \"زود صفحة تسعير\" أو metwily --plan \"ابني SaaS\"");
      return;
    }
    const intent = detectIntent(prompt);
    const mode = opts.plan || intent === "plan" ? "plan" : "build";
    if (mode === "plan") console.log("[plan] وضع الخطة — أدوات القراءة فقط.\n");
    try {
      const out = await runAgent(prompt, {
        cwd: opts.cwd,
        mode,
        onText: (d: string) => process.stdout.write(d),
      });
      void out;
      process.stdout.write("\n");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("DEEPSEEK_API_KEY")) {
        console.error("\n⚠️ " + msg);
        console.error("شغّل: set DEEPSEEK_API_KEY=sk-... (أو ضعه في .env)");
      } else {
        console.error("\n❌ خطأ: " + msg);
      }
      process.exitCode = 1;
    }
  });

program.parse();
