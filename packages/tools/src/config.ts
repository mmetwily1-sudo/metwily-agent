// @metwily/tools/config — درس Continue: ملف ضبط واحد (metwily.json) باكتشاف متدرج.
// cwd/metwily.json ← ‏~/.config/metwily.json ← القيم الافتراضية.
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface MetwilyConfig {
  model: "deepseek-chat" | "deepseek-reasoner";
  autoCommit: boolean;
  maxSteps: number;
  historyCharsCap: number;
  historyKeepLast: number;
}

export const DEFAULT_CONFIG: MetwilyConfig = {
  model: "deepseek-chat",
  autoCommit: true,
  maxSteps: 15,
  historyCharsCap: 60_000,
  historyKeepLast: 10,
};

const cache = new Map<string, MetwilyConfig>();

export async function loadConfig(cwd: string): Promise<MetwilyConfig> {
  const hit = cache.get(path.resolve(cwd));
  if (hit) return hit;
  const merged: MetwilyConfig = { ...DEFAULT_CONFIG };
  for (const file of [path.join(os.homedir(), ".config", "metwily.json"), path.join(path.resolve(cwd), "metwily.json")]) {
    const raw = await fs.readFile(file, "utf8").catch(() => "");
    if (!raw) continue;
    try {
      Object.assign(merged, JSON.parse(raw));
    } catch {
      // ملف ضبط مكسور — تجاهله واستخدم السابق
    }
  }
  if (process.env.METWILY_AUTOCOMMIT === "0") merged.autoCommit = false;
  if (process.env.METWILY_AUTOCOMMIT === "1") merged.autoCommit = true;
  cache.set(path.resolve(cwd), merged);
  return merged;
}

export function clearConfigCache(): void {
  cache.clear();
}
