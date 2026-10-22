# ربط أي موديل بمتولي عبر بروكسي محلي

الأداة المرجعية: **AIClient-2-API** — بروكسي Node.js يحوّل جلسات Gemini CLI وQwen Code
وKiro وGrok وCodex إلى واجهة OpenAI واحدة على جهازك. متولي يتعامل معه كمزود عادي،
**بدون نسخ أي كود منه** (رخصته GPL-3.0 وتشتغل كعملية منفصلة).

## 1) التشغيل (مرة واحدة)

```powershell
cd D:\tools\aiclient2api
npm install      # تم بالفعل
npm start        # لوحة التحكم: http://localhost:3000
```

## 2) ربط الحسابات

من اللوحة: أضف حساباً واحداً على الأقل (Google / Qwen / Kiro / Grok...).
ملفات الاعتماد تُحفظ محلياً في `D:\tools\aiclient2api\configs\` — لا ترفعها لأي ريبو.

> تنبيه صادق: هذه الجلسات مخصصة للاستخدام داخل تطبيقاتها الرسمية. الاستخدام المكثف
> خارجها قد يخالف شروط الخدمة ويُعرّض الحساب للإيقاف. استخدم حساباً تجريبياً.

## 3) الربط بمتولي

```powershell
$env:METWILY_PROVIDER="proxy"
$env:METWILY_PROXY_URL="http://127.0.0.1:3000/v1"
$env:METWILY_MODEL="[Gemini CLI] gemini-2.5-flash"
metwily models
metwily --model "[Gemini CLI] gemini-2.5-flash" "افحص المشروع"
```

- مسار مزود محدد: `METWILY_PROXY_URL=http://127.0.0.1:3000/gemini-cli-oauth/v1`
- عدة موديلات بتناوب تلقائي عند 429: `METWILY_PROXY_MODELS="model-a,model-b"`
- بدون `METWILY_PROVIDER=proxy` يظل DeepSeek/Gemini هو الافتراضي، والبروكسي احتياطي.

## 4) لماذا لا ندمج كوده؟

GPL-3.0 كانت ستفرض نفس الرخصة على متولي (Apache-2.0). الفصل بعملية خارجية +
HTTP يحفظ الترخيصين، ويسمح بتبديل البروكسي (LiteLLM، Ollama، أي مجمّع) دون تغيير كودنا.
