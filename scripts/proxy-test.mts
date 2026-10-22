// scripts/proxy-test.mts — تحقق offline من مسار البروكسي (بدون حساب/حصة).
// سيرفر وهمي متوافق OpenAI → proxyConfig → listProxyModels → getCandidateModels.
import { createServer } from "node:http";

const server = createServer((req, res) => {
  if (req.url === "/v1/models") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ object: "list", data: [{ id: "mock-model" }, { id: "mock-model-2" }] }));
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as { port: number }).port;
process.env.METWILY_PROVIDER = "proxy";
process.env.METWILY_PROXY_URL = `http://127.0.0.1:${port}/v1`;
process.env.METWILY_PROXY_KEY = "123456";
process.env.METWILY_PROXY_MODELS = "mock-model,mock-model-2";
delete process.env.DEEPSEEK_API_KEY;
delete process.env.GEMINI_API_KEY;

const { getCandidateModels } = await import("../packages/llm/src/router.js");
const { listProxyModels, proxyConfig } = await import("../packages/llm/src/proxy.js");

let pass = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) pass++;
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
};

const cfg = proxyConfig();
ok("proxyConfig يقرأ URL والمفتاح", cfg?.baseURL === process.env.METWILY_PROXY_URL && cfg?.apiKey === "123456");

const models = await listProxyModels(cfg);
ok("listProxyModels يجيب القائمة", models.join(",") === "mock-model,mock-model-2", models.join(","));

const candidates = await getCandidateModels();
const labels = candidates.map((c) => c.label).join(",");
ok("المرشحون من البروكسي فقط عند اختياره", candidates.length === 2 && labels === "proxy/mock-model,proxy/mock-model-2", labels);

server.close();
console.log(`\nPROXY: ${pass}/3`);
if (pass !== 3) process.exitCode = 1;
