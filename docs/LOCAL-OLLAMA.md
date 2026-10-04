# تشغيل متولي بعقل محلي (Ollama) — مجاني وغير محدود

## لماذا؟
الحصص السحابية المجانية تنفد (DeepSeek رصيد صفر، Gemini ~20 طلب/يوم). العقل المحلي يعمل بلا حدود وبلا إنترنت بعد التنزيل.

## الإعداد (مرة واحدة، على جهازك)
```powershell
# 1. شغّل السيرفر (Ollama مثبّت في D:\Ollama)
D:\Ollama\ollama.exe serve
# 2. في نافذة ثانية: نزّل موديلاً صغيراً (~2GB)
D:\Ollama\ollama.exe pull qwen2.5:3b
```

## التشغيل
```powershell
$env:METWILY_PROVIDER="ollama"
$env:METWILY_OLLAMA_MODEL="qwen2.5:3b"   # اختياري
pnpm exec tsx packages/cli/src/index.ts --plan "اشرح هيكل الريبو"
```

## ملاحظات صادقة
- `qwen2.5:3b` صغير (~2GB): فهم جيد، وتعامل محدود مع الأدوات المعقدة — للمهام البسيطة والمتوسطة.
- للمهام الصعبة: `qwen3:8b` (~5GB) أو مفتاح سحابي مدفوع.
- متولي يكتشف Ollama تلقائياً عند ضبط `METWILY_PROVIDER=ollama` (نفس اتفاقية `AGENT_LLM_URL` في منارة).
