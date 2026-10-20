export const projectRoot: string;
export const sources: string[];
export function ensurePosterThumbnails(options?: {
  root?: string;
  output?: string;
  log?: (message: string) => void;
}): Promise<{ generated: number; skipped: boolean }>;
export function runPosterThumbnailGeneration(options?: { root?: string }): Promise<{ generated: number; skipped: boolean }>;
