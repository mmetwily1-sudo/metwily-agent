# دروس من Aider (Aider-AI/aider — Apache-2.0) — ما نُقل إلى metwily-agent

درسنا `aider/repomap.py` (الخوارزمية) + تصميم الـ auto-commit (من التوثيق والتجربة).

## 1. repo-map → `packages/tools/src/repomap.ts`
- **الأصل:** ctags/tree-sitter tags (def/ref) → جراف MultiDi + **personalized PageRank** (تعزيز الملفات المفتوحة في المحادثة) → عرض شجري بميزانية توكن (~1024) + cache على القرص بمفتاح mtime.
- **النقل:** نفس الخطوات تماماً، بفروق واعية:
  - tags بـ regex لـ TS/JS بدل tree-sitter (يكفي لمشاريعنا، وبدون تبعيات ثقيلة).
  - PageRank يدوي (~20 تكرار، damping 0.85) بدل networkx.
  - الـ personalization من `readFiles` (الملفات المقروءة) — نفس فكرة `chat_fnames`.
  - الـ cache في `.metwily/map.json` بمفتاح [مسار+mtime] — نفس فكرة `TAGS_CACHE`.
  - سقف ~4000 حرف (~1000 توكن) — نفس ميزانية Aider.
- **مكشوفة كأداة `map`** للوكيل + موصى بها في الـ system prompt ("ابدأ بها").

## 2. auto-commit → `packages/tools/src/git.ts`
- **الأصل:** كل تعديل AI يُوثق commit برسالة واضحة — audit trail + rollback سهل.
- **النقل:** بعد كل `edit` ناجحة: `git add` + `git commit "metwily: edit <file>"` — فقط داخل git repo، ويُعطّل من `metwily.json` أو `--no-commit` أو `METWILY_AUTOCOMMIT=0`.

## 3. config file → `packages/tools/src/config.ts` (درس Continue)
- ملف `metwily.json` واحد (model/autoCommit/maxSteps/history*) باكتشاف متدرج: المشروع ← `~/.config` ← الافتراضي. مثال في `metwily.json.example`.

## ما لم ننقل
- tree-sitter الحقيقي + networkx: دقة أعلى للغات كثيرة — تُضاف عندما ندعم Python/غيره بجدية.
- watch-mode + voice + lint-loop التلقائي: لاحقاً.
- deepseek-harness (Cordis): عزل البلاجن كـ subprocess — معمارياً جميل لكن تكلفة تعقيد عالية على MVP؛ فكرته محفوظة للمراجعة عند v0.3.
