// @metwily/tools/policy — محرك سياسة مركزي لأوامر run (أساس الـ sandbox لاحقاً).
// يدمج افتراضات المجلس + metwily.json (allowRun/denyRun/runTimeoutMs).

export const DEFAULT_ALLOW_RUN = [
  "bun",
  "npm",
  "pnpm",
  "npx tsc",
  "tsc",
  "git status",
  "git diff",
  "git log",
  "ls",
  "node",
];

export const DEFAULT_DENY_PATTERNS = [/rm\s+-rf/, /sudo/, /curl.*\|\s*(ba)?sh/, /git\s+push/];

export interface PolicyConfig {
  allowRun?: string[];
  denyRun?: string[];
  runTimeoutMs?: number;
}

export interface PolicyDecision {
  decision: "allow" | "deny";
  reason: string;
}

// تحليل شبيه بالـ shell يحترم الاقتباس: git commit -m "a b" → [git,commit,-m,"a b"]
export function tokenize(cmd: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let quote: string | null = null;
  let started = false;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && i + 1 < cmd.length && (cmd[i + 1] === quote || cmd[i + 1] === "\\")) cur += cmd[++i];
      else cur += ch;
      started = true;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) {
        tokens.push(cur);
        cur = "";
        started = false;
      }
    } else {
      cur += ch;
      started = true;
    }
  }
  if (started) tokens.push(cur);
  return tokens;
}

export function evaluateRun(command: string, cfg: PolicyConfig = {}): PolicyDecision {
  const cmd = command.trim();
  if (!cmd) return { decision: "deny", reason: "أمر فارغ" };
  const denyRes = [...DEFAULT_DENY_PATTERNS];
  for (const src of cfg.denyRun ?? []) {
    try {
      denyRes.push(new RegExp(src));
    } catch {
      // نمط مكسور في الضبط — يُتجاهل بدل كسر الجلسة
    }
  }
  for (const re of denyRes) {
    if (re.test(cmd)) return { decision: "deny", reason: `مطابق لنمط ممنوع: ${re.source}` };
  }
  const allow = cfg.allowRun ?? DEFAULT_ALLOW_RUN;
  const tokens = tokenize(cmd);
  const norm = tokens.join(" ");
  const ok = allow.some((p) => (p.includes(" ") ? norm === p || norm.startsWith(p + " ") : tokens[0] === p));
  if (!ok) return { decision: "deny", reason: `خارج الـ allowlist — المتاح: ${allow.join(", ")}` };
  return { decision: "allow", reason: "مسموح" };
}
