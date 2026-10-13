/** Runtime-independent validation error; hosts translate it into their public errors. */
export class StructuredNoteError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
    this.name = "StructuredNoteError";
  }
}
export const requiredStructuredString = (value: unknown, label: string) => {
  if (typeof value !== "string" || !value.trim()) throw new StructuredNoteError("invalid_params", `${label} is required`, 400);
  return value.trim();
};
