import { layoutPosterContent as layout, StructuredNoteError } from "@edgeever/shared";
import { AppError } from "./app-error";
export type { PosterSection, PosterContentPlan } from "@edgeever/shared";
export const layoutPosterContent: typeof layout = (...args) => {
  try { return layout(...args); } catch (error) {
    if (error instanceof StructuredNoteError) throw new AppError(error.code, error.message, error.status);
    throw error;
  }
};
