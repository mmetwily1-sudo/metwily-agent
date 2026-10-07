#!/usr/bin/env node
// نقطة دخول السيرفر للحاويات: bun build ... --outfile metwily-server
// الإعداد عبر PORT/HOST (افتراضي 3847/127.0.0.1 — وفي الحاوية HOST=0.0.0.0).
import { startServer } from "./index.js";

const port = Number(process.env.PORT ?? 3847) || 3847;
const host = (process.env.HOST ?? "127.0.0.1").trim() || "127.0.0.1";

const handle = await startServer(port, host);
console.log(`metwily server on ${handle.url}`);
