import { validateTableCells, tableFieldInput as fieldInput, ensureUniqueTableFieldName as unique, applyTableSchemaOperations as schema, StructuredNoteError,
  docToText, markdownToDoc, stripTableDocumentMarker, type MemoDetail, type TableDocument,
} from "@edgeever/shared";
import { AppError } from "./app-error";
import type { DatabaseAdapter } from "./storage-contract";

export const memoWithoutTablePayload = (memo: MemoDetail) => {
  const contentMarkdown = stripTableDocumentMarker(memo.contentMarkdown);
  const contentJson = markdownToDoc(contentMarkdown);
  return { ...memo, contentMarkdown, contentJson, contentText: docToText(contentJson) };
};

export const requiredTableRevision = (value: unknown) => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new AppError("invalid_params", "expectedRevision must be a non-negative integer", 400);
  }
  return value as number;
};

export const tableCellPatch = async (db: DatabaseAdapter, memoId: string, document: TableDocument, value: unknown, allowEmpty: boolean) => {
  try {
    return await validateTableCells(async resourceId => {
      const resource = await db.prepare(`SELECT id, filename, mime_type, byte_size FROM resources WHERE id = ? AND memo_id = ? AND kind = 'attachment' AND is_deleted = 0`)
        .bind(resourceId, memoId).first<{ id: string; filename: string | null; mime_type: string | null; byte_size: number }>();
      return resource ? { resourceId: resource.id, filename: resource.filename ?? "attachment", mimeType: resource.mime_type ?? "application/octet-stream", byteSize: resource.byte_size } : null;
    }, document, value, allowEmpty);
  } catch (error) { return translate(error); }
};
export const tableFieldInput: typeof fieldInput = (...args) => { try { return fieldInput(...args); } catch (error) { return translate(error); } };
export const ensureUniqueTableFieldName: typeof unique = (...args) => { try { return unique(...args); } catch (error) { return translate(error); } };
export const applyTableSchemaOperations: typeof schema = (...args) => { try { return schema(...args); } catch (error) { return translate(error); } };
export { tableSchemaImpact } from "@edgeever/shared";

const translate = (error: unknown): never => {
  if (error instanceof StructuredNoteError) throw new AppError(error.code, error.message, error.status);
  throw error;
};
