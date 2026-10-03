#!/usr/bin/env node
// metwily CLI — binary: metwily
import { Command } from "commander";

const program = new Command();
program.name("metwily").description("متولي — Arabic-first coding agent").version("0.1.0");

program
  .argument("[prompt]", "الأمر أو النية (عربي أو إنجليزي)")
  .option("--plan", "عرض الخطة فقط بدون تنفيذ")
  .option("--resume", "إكمال آخر جلسة")
  .action(async (prompt, opts) => {
    if (opts.resume) {
      console.log("استئناف آخر جلسة من .metwily/state.json ...");
      return;
    }
    if (!prompt) {
      console.log("استخدم: metwily \"زود صفحة تسعير\" أو metwily --plan \"ابني SaaS\"");
      return;
    }
    if (opts.plan) {
      console.log(`[plan] الخطة لـ: ${prompt}`);
      console.log("1. read/search الملفات 2. edit دقيق 3. check (typecheck/test)");
      return;
    }
    console.log(`[run] تنفيذ: ${prompt}`);
    console.log("TODO: ربط agent loop (packages/core) هنا");
  });

program.parse();
