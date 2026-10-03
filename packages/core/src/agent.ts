// verify loop + budget guard + approval — قرار المجلس
export const MAX_STEPS = 15;
export const COMPACTION_AT = 0.7; // عند 70% من النافذة
export const READ_SLICE_LINES = 50;
export const TOOL_OUTPUT_TRUNCATE = 2000;

export function mustReadBeforeEdit(readFiles: Set<string>, file: string): boolean {
  return readFiles.has(file);
}
