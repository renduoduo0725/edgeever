import {
  applyDiagramOperations as apply,
  parseDiagramMemoIr as parse,
  StructuredNoteError,
} from "@edgeever/shared";
import { AppError } from "./app-error";

export { diagramSemanticGraph, memoWithoutDiagramPayload } from "@edgeever/shared";

const translate = (error: unknown): never => {
  if (error instanceof StructuredNoteError) throw new AppError(error.code, error.message, error.status);
  throw error;
};

export const parseDiagramMemoIr: typeof parse = (...args) => {
  try { return parse(...args); } catch (error) { return translate(error); }
};

export const applyDiagramOperations: typeof apply = async (...args) => {
  try { return await apply(...args); } catch (error) { return translate(error); }
};
