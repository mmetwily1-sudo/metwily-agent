# دروس من opencode (sst/opencode — MIT) — ما نُقل فعلاً إلى metwily-agent

درسنا `packages/opencode/src/{tool,session}` (نسخة shallow+sparse، حُذفت بعد الدراسة لتوفير المساحة).

## ما تم نقله (بتصرف لمعماريتنا)

1. **tool/read.ts → `packages/tools/src/fs.ts`**
   - `read` تدعم المجلدات (عرض المحتويات) — نفذناها.
   - عند غياب الملف: اقتراح "Did you mean؟" بأقرب 3 أسماء — نفذناها (`missHint`).
   - سقف البايتات + تقطيع الأسطر الطويلة (50KB / 2000 حرف) — كان عندنا جزئياً، وحّدناه.
   - ملاحظة لم ننقلها: LSP warm-up وEffect — ثقيلة على MVP، مؤجلة.

2. **tool/truncate.ts → `spill` + `preview`**
   - opencode يحفظ المخرجات الكاملة في `truncation dir` مع retention 7 أيام ويعرض تلميح grep/read.
   - نفذنا: `spill()` يكتب `.metwily/tmp/tool_<ts>.log` حقيقياً (قبلها كنا ندّعي الحفظ كذباً!) + `preview()` يعرض المعاينة والمسار.
   - مؤجل: التنظيف الدوري (retention) — يُضاف مع الـ deploy.

3. **session/compaction.ts + session persistence → `packages/core/src/agent.ts`**
   - opencode يسلسل المحادثة (user/assistant/tool مع تقليم نتائج الأدوات القديمة) ويلخص عبر LLM.
   - نفذنا v1: `state.json` يحفظ التبادلات + `compactHistory()` rule-based (الهدف الأول + marker + آخر 10، سقف 60k حرف).
   - الترقية الموثقة: ملخص LLM حقيقي بدل الـ marker — تُفعّل مع مفتاح مدفوع/مجاني.

4. **permission/evaluate + `ctx.ask` → تأكيد CLI**
   - opencode لديه محرك صلاحيات كامل (allow/deny/ask per pattern).
   - نفذنا v1 خفيف: تأكيد `y/N` قبل أي جلسة build (+ `METWILY_YES=1` للأتمتة). المحرك الكامل مؤجل لمرحلة الـ sandbox.

## ما لم ننقل (عمداً)
- Effect ecosystem: قوي لكن منحنى تعلم وتكلفة تبعية عالية — نبقى على async/await المباشر.
- SQLite/Drizzle للجلسات: JSONL + state.json تكفيان حتى v0.2.
- MCP/Plugins الكاملة: مجلد `skills/` موجود بالمعيار المتوافق، والتنفيذ الكامل لاحقاً.
