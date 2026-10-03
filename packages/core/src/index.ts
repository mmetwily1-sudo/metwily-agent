// @metwily/core — agent loop: observe → plan → act → verify
export type ToolName = "read" | "search" | "edit" | "run" | "check";

export interface AgentState {
  messages: unknown[];
  cwd: string;
  mode: "plan" | "build";
  steps: number;
  maxSteps?: number;
}

export async function runLoop(state: AgentState): Promise<void> {
  const max = state.maxSteps ?? 15;
  // حد الأمان: budget guard
  for (let i = state.steps; i < max; i++) {
    // TODO: 1. observe 2. plan 3. act(tool) 4. verify
    // قاعدة إجبارية: edit مرفوضة بدون read مسبق لنفس الملف
    // قاعدة إجبارية: لا done قبل check=test أخضر
    void i;
    break;
  }
}

export * from "./agent.js";
