# metwily-agent (متولي) 🤖

Arabic-first coding agent — TypeScript + Bun, CLI-first.

> مجلس الخبراء: Claude + ChatGPT + DeepSeek + Gemini + Grok + Qwen + Dick + المؤسس

## القرار المعتمد
- **Stack:** TypeScript + Bun (Node للـ deploy)
- **Interface:** CLI أولاً (`metwily`)
- **Hosting:** Fly.io (worker) + Vercel (UI لاحقاً)
- **Loop:** observe → plan → act → verify + budget guard

## MVP (5 أدوات)
`read` + `search` + `edit` + `run` + `check`

## تشغيل
```bash
pnpm install
pnpm --filter @metwily/cli dev "زود صفحة تسعير"
pnpm --filter @metwily/cli dev --plan "ابني SaaS"
```

## الهيكل
```
packages/core/   # agent loop + context + repo-map
packages/tools/  # fs, shell, git (ACI مجردة)
packages/llm/    # intent عربي + provider abstraction
packages/cli/    # binary `metwily` (commander + clack)
skills/          # SKILL.md متوافق مع Claude/opencode
infra/           # fly.toml + Dockerfile
```
