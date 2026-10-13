import { compilePosterMemo as compile, applyPosterEdits as apply, StructuredNoteError } from "@edgeever/shared";
import { AppError } from "./app-error";
export { posterPatchSchema, posterCapabilities } from "@edgeever/shared";
const translate = (error: unknown): never => {
  if (error instanceof StructuredNoteError) throw new AppError(error.code, error.message, error.status);
  throw error;
};
export const compilePosterMemo: typeof compile = (...args) => {
  try { return compile(...args); } catch (error) { return translate(error); }
};
export const applyPosterEdits: typeof apply = (...args) => {
  try { return apply(...args); } catch (error) { return translate(error); }
};
