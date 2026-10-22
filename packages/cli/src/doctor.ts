// packages/cli/src/doctor.ts — فحص الوضع المحلي (Ollama/RAM/disk) وتوصية موديل.
import { statfs } from "node:fs/promises";
import { totalmem, freemem } from "node:os";
import { ollamaBaseUrl, isOllamaReachable, pickLocalModel } from "@metwily/llm/router.js";

interface OllamaTag {
  name: string;
  size?: number;
  details?: { parameter_size?: string };
}

async function getJson<T>(url: string, init?: RequestInit, timeoutMs = 4000): Promise<T | undefined> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return undefined;
    return (await res.json()) as T;
  } catch {
    return undefined;
  }
}

export async function runDoctor(): Promise<void> {
  const base = ollamaBaseUrl().replace(/\/v1\/?$/, "");
  console.log("🩺 متولي doctor\n");

  const up = await isOllamaReachable();
  const version = up ? await getJson<{ version: string }>(`${base}/api/version`) : undefined;
  console.log(`• Ollama: ${up ? `شغال (${version?.version ?? "?"})` : "متوقف"} — ${base}`);

  if (!up) {
    console.log("  شغّله: ollama serve   (أو دبل كليك على Ollama من قائمة ابدأ)");
    console.log("  التثبيت: https://ollama.com/download");
  } else {
    const tags = await getJson<{ models?: OllamaTag[] }>(`${base}/api/tags`);
    const models = tags?.models ?? [];
    if (models.length === 0) {
      console.log("• مفيش موديلات مثبتة — اسحب واحد: ollama pull qwen2.5-coder:3b");
    } else {
      console.log(`• موديلات مثبتة (${models.length}):`);
      for (const m of models) {
        const gb = m.size ? ` — ${(m.size / 1e9).toFixed(1)}GB` : "";
        console.log(`  - ${m.name}${gb}`);
      }
    }

    const selected = await pickLocalModel();
    const show = await getJson<{ capabilities?: string[] }>(`${base}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: selected }),
    });
    const caps = show?.capabilities ?? [];
    const tools = caps.includes("tools");
    console.log(`• الموديل المختار: ${selected} — tools ${tools ? "✅" : "❌ (استدعاء الأدوات غالباً هيفشل)"}`);

    const hasTuned = models.some((m) => m.name === "metwily-local" || m.name.startsWith("metwily-local:"));
    if (!hasTuned) {
      console.log('\n  نسخة مضبوطة (num_ctx 8192 + temperature 0):');
      console.log("  ollama create metwily-local -f infra/ollama/Modelfile");
    }
  }

  const ram = totalmem() / 1e9;
  const free = freemem() / 1e9;
  console.log(`\n• الرام: ${ram.toFixed(1)}GB (متاح ${free.toFixed(1)}GB)`);
  const advice = ram >= 15 ? "7B-8B Q4" : ram >= 10 ? "4B-7B Q4" : "3B أو أقل (Q4)";
  console.log(`  التوصية للجهاز: ${advice}`);

  try {
    const st = await statfs(process.cwd());
    const freeGb = (st.bavail * st.bsize) / 1e9;
    console.log(`• مساحة حرة (${process.cwd().slice(0, 2)}): ${freeGb.toFixed(1)}GB${freeGb < 3 ? " ⚠️" : ""}`);
  } catch {
    // تجاهل
  }

  const provider = (process.env.METWILY_PROVIDER ?? "").trim().toLowerCase();
  console.log(`• METWILY_PROVIDER: ${provider || "(غير مضبوط — محلي أولاً لو Ollama شغال)"}`);
  if (up && provider !== "ollama" && provider !== "local") {
    console.log("  لإجبار المحلي فقط: set METWILY_PROVIDER=ollama");
  }
}
