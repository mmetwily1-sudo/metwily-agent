// @metwily/tools/git — درس Aider: كل تعديل يُوثق commit تلقائياً (audit trail + rollback).
import { execFile } from "node:child_process";
import path from "node:path";

function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile("git", args, { cwd, timeout: 30_000 }, (err, stdout, stderr) => {
      resolve(err ? `ERR:${stderr || err.message}` : stdout);
    });
  });
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  const out = await git(cwd, ["rev-parse", "--is-inside-work-tree"]);
  return out.trim() === "true";
}

// commit تلقائي برسالة واضحة. يُفعّل من config (autoCommit) ويُعطّل بـ --no-commit.
export async function autoCommitFile(cwd: string, filePath: string, enabled: boolean): Promise<string> {
  if (!enabled) return "";
  if (!(await isGitRepo(cwd))) return "";
  const rel = path.relative(path.resolve(cwd), path.resolve(cwd, filePath));
  const add = await git(cwd, ["add", "--", rel]);
  if (add.startsWith("ERR:")) return "";
  const msg = `metwily: edit ${rel}`;
  const commit = await git(cwd, ["commit", "-m", msg, "--no-verify"]);
  if (commit.startsWith("ERR:")) return "";
  return ` (auto-commit: ${msg})`;
}
