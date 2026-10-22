// scripts/local-test.mts — تحقق offline من المسار المحلي (Ollama أولاً).
// سيرفر وهمي يحاكي Ollama (/api/tags, /api/show, /v1) → getCandidateModels.
import { createServer } from "node:http";

const server = createServer((req, res) => {
  if (req.url === "/api/tags") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ models: [{ name: "metwily-local:latest" }, { name: "qwen2.5:1.5b" }] }));
    return;
  }
  if (req.url === "/api/version") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ version: "0.0.0-mock" }));
    return;
  }
  if (req.url === "/api/show") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ capabilities: ["completion", "tools"] }));
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as { port: number }).port;

process.env.AGENT_LLM_URL = `http://127.0.0.1:${port}/v1`;
delete process.env.METWILY_PROVIDER;
delete process.env.METWILY_PROXY_URL;
delete process.env.METWILY_PROXY_KEY;
delete process.env.METWILY_PROXY_MODELS;
delete process.env.METWILY_OLLAMA_MODEL;
delete process.env.AGENT_LLM_MODEL;
delete process.env.DEEPSEEK_API_KEY;
delete process.env.GEMINI_API_KEY;

const { getCandidateModels, isOllamaReachable, pickLocalModel } = await import("../packages/llm/src/router.js");

let pass = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) pass++;
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
};

ok("Ollama يُكتشف من /api/tags", await isOllamaReachable(2000));
ok("اختُير metwily-local من الأفضلية", (await pickLocalModel()) === "metwily-local:latest", await pickLocalModel());

const solo = await getCandidateModels();
ok(
  "بدون مفاتيح: مرشح محلي واحد فقط",
  solo.length === 1 && solo[0].label === "ollama/metwily-local:latest",
  solo.map((c) => c.label).join(","),
);

process.env.DEEPSEEK_API_KEY = "sk-test-not-used-until-call";
const mixed = await getCandidateModels();
const labels = mixed.map((c) => c.label).join(",");
ok("مع مفتاح سحابي: المحلي أولاً ثم السحابة", labels.startsWith("ollama/metwily-local:latest,deepseek/"), labels);

process.env.METWILY_PROVIDER = "ollama";
const forced = await getCandidateModels();
ok(
  "METWILY_PROVIDER=ollama: محلي فقط بلا fallback",
  forced.length === 1 && forced[0].label === "ollama/metwily-local:latest",
  forced.map((c) => c.label).join(","),
);

server.close();
console.log(`\nLOCAL: ${pass}/5`);
if (pass !== 5) process.exitCode = 1;
