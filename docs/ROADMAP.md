# خارطة بناء متولي (metwily-agent) — حية

## v0.1 — الـ harness الأساسي ✅ تم
- [x] loop حقيقي (Vercel AI SDK + DeepSeek/Gemini) + streaming CLI
- [x] أدوات: map/read/search/edit/run/check + spill + miss-hint + dir-read
- [x] أمان: deny-list + allowlist + read-before-edit + تأكيد build + audit.log
- [x] ذاكرة: state.json + compaction + --resume
- [x] repo-map (PageRank) + git auto-commit + metwily.json
- [x] تناوب 6 مفاتيح Gemini + fallback البوابة البديلة
- [x] اختبارات دخانية 17/17 + tsc أخضر + CI

## v0.2 — أول dogfood كامل 🔄 جارٍ (محظور بالحصة المجانية)
- [ ] مهمة build حية أولى: تعديل README + auto-commit (جرّبت: read→search نجحا، الـ edit مات بالحصة)
- [x] عداد تكلفة/توكن لكل جلسة (usage من الـ SDK → audit + طباعة) — 2026-10-04
- [x] مزوّد Ollama المحلي (METWILY_PROVIDER=ollama) — مفحوص tsc، التشغيل الحي عند تثبيت Ollama
- [x] flag --model لتجاوز الموديل من CLI
- [ ] ملخص LLM للـ compaction بدل الـ marker القاعدي
- [ ] أول dogfood على repo خارجي صغير

## v0.3 — الاستقلال والقوة
- [ ] موديل محلي عبر Ollama كمزوّد ثالث (Qwen3-Coder)
- [ ] sandbox حقيقي (Docker + gVisor) بدل الثقة بالـ allowlist
- [ ] MCP servers (توافق كامل مع opencode/Claude)
- [ ] Web UI فوق نفس الـ API

## v1.0 — الإطلاق
- [ ] binary واحد (`bun build --compile` → metwily.exe)
- [ ] نشر Fly.io + Vercel
- [ ] mini-eval خاص (25 مهمة) + تقرير دقة صادق
- [ ] رخصة Apache-2.0 + إعلان عام

## القاعدة الذهبية
لا ميزة بدون اختبار دخاني أخضر، ولا ادعاء بدون دليل في audit.log.
