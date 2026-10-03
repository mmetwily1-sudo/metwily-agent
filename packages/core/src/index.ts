// @metwily/core — agent loop: observe → plan → act → verify
export type ToolName = "read" | "search" | "edit" | "run" | "check";

export interface AgentState {
  messages: unknown[];
  cwd: string;
  mode: "plan" | "build";
  steps: number;
  maxSteps?: number;
}

export { MAX_STEPS, compactHistory, loadHistory, mustReadBeforeEdit, runAgent, saveHistory } from "./agent.js";
export type { RunOptions, StoredMsg } from "./agent.js";
