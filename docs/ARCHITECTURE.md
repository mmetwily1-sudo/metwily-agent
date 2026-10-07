# معمارية متولي (v0.2.0)

```
┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐
│ CLI (thin)  │  │ Server (SSE) │  │ Web UI (static)     │
│ metwily ... │  │ POST /v1/chat│  │ index.html          │
└──────┬──────┘  └──────┬───────┘  └─────────────────────┘
       │                │
       └────────┬───────┘
                ▼
┌─────────────────────────────────────────┐
│ core/agent.ts — runAgent                 │
│ observe → plan → act → verify + budget   │
│ session (state.json) + compaction        │
│ audit.log.jsonl (session ids)            │
└───┬─────────┬───────────┬───────────────┘
    │         │           │
    ▼         ▼           ▼
┌────────┐ ┌──────┐ ┌────────────────┐
│ tools  │ │ llm  │ │ MCP dynamic    │
│ map    │ │router│ │ mcp_* tools    │
│ read   │ │deep/ │ └────────────────┘
│ search │ │gem/  │
│ check  │ │ollama│
│ edit*  │ │echo  │
│ run*   │ │costs │
└───┬────┘ └──────┘
    │
    ▼
┌──────────────────────────────┐
│ policy.ts (allow/deny/ask)   │
│ أساس الـ sandbox التنفيذي    │
└──────────────────────────────┘
* تحتاج تأكيد build + تُوثق auto-commit
```

## المبادئ
1. **الجسم/العقل منفصلان**: الـ harness ملكنا، الموديل قابل للتبديل (سطر واحد).
2. **deny-by-default**: كل تنفيذ يمر بالسياسة + allowlist.
3. **لا ادعاء بدون دليل**: كل فعل في audit، كل اختبار أخضر قبل push.
4. **التطوير بلا حصة أولاً**: مزود echo يجعل كل ميزة قابلة للاختبار offline.

## تدفق البيانات
prompt → intent عربي → history+compaction → tools (map أولاً) → verify (check)
→ auto-commit → usage/audit → state.json → dataset exporter (دولاب الذكاء الخاص).
