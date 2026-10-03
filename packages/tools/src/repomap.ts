// @metwily/tools/repomap — نقل خوارزمية Aider: def/ref tags → PageRank → خريطة مضغوطة.
// Aider يستخدم tree-sitter عبر grep_ast + networkx؛ هنا port خفيف بـ regex (يكفي TS/JS)
// + PageRank يدوي بدون اعتماديات + personalization من الملفات المقروءة (chat_fnames).
import { promises as fs } from "node:fs";
import path from "node:path";

export const REPO_MAP_MAX_CHARS = 4000;
const MAX_FILES = 200;

const DEF_PATTERNS = [
  /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
  /export\s+(?:default\s+)?(?:class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
  /export\s+const\s+([A-Za-z_$][\w$]*)/g,
  /^export\s+default\s+([A-Za-z_$][\w$]*)/gm,
];

const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);

export interface FileTags {
  file: string;
  defs: string[];
}

function extractDefs(text: string): string[] {
  const out = new Set<string>();
  for (const re of DEF_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) out.add(m[1]);
  }
  return [...out].slice(0, 60);
}

async function collectFiles(cwd: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 6 || files.length >= MAX_FILES) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "dist") continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full, depth + 1);
      else if (CODE_EXT.has(path.extname(e.name).toLowerCase())) files.push(full);
    }
  }
  await walk(cwd, 0);
  return files.sort();
}

// PageRank يدوي على جراف الملفات: حافة من الملف المُشير → الملف المُعرّف.
function pageRank(
  nodes: string[],
  edges: Array<[number, number, number]>,
  personalization: Map<number, number>,
  iters = 20,
  damping = 0.85
): number[] {
  const n = nodes.length;
  const out = new Array<number>(n).fill(0);
  for (const [from, , w] of edges) out[from] += w;
  let rank = nodes.map((_, i) => (personalization.get(i) ?? 0) + 1 / n);
  for (let k = 0; k < iters; k++) {
    const next = new Array<number>(n).fill((1 - damping) / n);
    for (const [from, to, w] of edges) {
      if (out[from] > 0) next[to] += damping * rank[from] * (w / out[from]);
    }
    for (const [i, p] of personalization) next[i] += damping * p * 0.1;
    rank = next;
  }
  return rank;
}

export async function buildRepoMap(cwd: string, readSet: Set<string> = new Set()): Promise<string> {
  const root = path.resolve(cwd);
  const cacheFile = path.join(root, ".metwily", "map.json");
  const files = await collectFiles(root);
  if (files.length === 0) return "(مشروع فارغ — لا ملفات كود)";

  // مفتاح الـ cache: المسارات + mtimes (مثل TAGS_CACHE في Aider).
  const stats = await Promise.all(files.map((f) => fs.stat(f).then((s) => s.mtimeMs).catch(() => 0)));
  const key = JSON.stringify(files.map((f, i) => [path.relative(root, f), stats[i]]));
  const cached = await fs.readFile(cacheFile, "utf8").then((t) => JSON.parse(t) as { key: string; map: string }).catch(() => undefined);
  if (cached && cached.key === key) return cached.map;

  const texts = await Promise.all(files.map((f) => fs.readFile(f, "utf8").catch(() => "")));
  const defsPerFile = texts.map(extractDefs);
  const defOwner = new Map<string, number[]>();
  defsPerFile.forEach((defs, i) => {
    for (const d of defs) {
      const arr = defOwner.get(d) ?? [];
      arr.push(i);
      defOwner.set(d, arr);
    }
  });

  const edges: Array<[number, number, number]> = [];
  texts.forEach((text, i) => {
    for (const [name, owners] of defOwner) {
      if (defsPerFile[i].includes(name)) continue;
      const re = new RegExp(`\\b${name}\\b`, "g");
      const count = (text.match(re) ?? []).length;
      if (count > 0) for (const o of owners) if (o !== i) edges.push([i, o, Math.min(count, 10)]);
    }
  });
  // ملف بلا إشارات: self-edge صغير (مثل Aider تماماً).
  defsPerFile.forEach((defs, i) => {
    if (defs.length > 0 && !edges.some(([f]) => f === i)) edges.push([i, i, 0.1]);
  });

  const personalization = new Map<number, number>();
  files.forEach((f, i) => {
    const rel = path.relative(root, f);
    if ([...readSet].some((r) => r === f || r === rel || r.endsWith(path.sep + rel))) personalization.set(i, 1);
  });

  const rank = pageRank(files, edges, personalization);
  const order = files.map((_, i) => i).sort((a, b) => rank[b] - rank[a]);

  let out = "";
  for (const i of order) {
    const rel = path.relative(root, files[i]);
    const defs = defsPerFile[i].slice(0, 12);
    if (defs.length === 0) continue;
    const block = `${rel}:\n${defs.map((d) => `  ${d}`).join("\n")}\n`;
    if (out.length + block.length > REPO_MAP_MAX_CHARS) break;
    out += block;
  }
  const map = out || "(لا رموز مصدّرة — مشروع صغير، استخدم read مباشرة)";
  await fs.mkdir(path.dirname(cacheFile), { recursive: true }).catch(() => {});
  await fs.writeFile(cacheFile, JSON.stringify({ key, map }), "utf8").catch(() => {});
  return map;
}
