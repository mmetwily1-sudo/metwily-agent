# metwily-agent (متولي) 🤖

Arabic-first coding agent — TypeScript + Bun, CLI-first.

> مجلس الخبراء: Claude + ChatGPT + DeepSeek + Gemini + Grok + Qwen + Dick + المؤسس

## القرار المعتمد
- **Stack:** TypeScript + Bun (Node للـ deploy)
- **Interface:** CLI أولاً (`metwily`)
- **Hosting:** Fly.io (worker) + Vercel (UI لاحقاً)
- **Loop:** observe → plan → act → verify + budget guard

## الأدوات (9)
`map` + `read` + `search` + `check` + `edit` + `run` + أي سيرفرات MCP من `metwily.json`

## التشغيل
```bash
pnpm install
# المفاتيح (متغيرات بيئة فقط — لا تُحفظ في ملفات):
# DeepSeek مدفوع: set DEEPSEEK_API_KEY=sk-...
# Gemini مجاني بتناوب: GEMINI_API_KEY ثم _2 إلى _6 (من aistudio.google.com)
# محلي: METWILY_PROVIDER=ollama (+ AGENT_LLM_URL/MODEL)

pnpm exec tsx packages/cli/src/index.ts "زود صفحة تسعير"
pnpm exec tsx packages/cli/src/index.ts --plan "ابني SaaS"
pnpm exec tsx packages/cli/src/index.ts --resume   # إكمال الجلسة السابقة
```

## binary واحد (Bun)
```bash
bun build packages/cli/src/index.ts --compile --outfile metwily.exe
./metwily.exe --help
```

## الهيكل
```
packages/core/   # agent loop + context + compaction + MCP loader
packages/tools/  # map/read/search/check/edit/run + policy + git + repomap + mcp
packages/llm/    # intent عربي + router (deepseek/gemini/ollama) + costs
packages/cli/    # binary `metwily`
skills/          # SKILL.md متوافق مع Claude/opencode
scripts/         # smoke.mts (28 اختباراً) + سيرفر MCP وهمي
docs/            # ROADMAP + دروس opencode/Aider
infra/           # fly.toml + Dockerfile
```
