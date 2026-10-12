import { z } from "zod";
import { PosterElementSchema, POSTER_TEMPLATES } from "@edgeever/shared";
import { posterPatchSchema } from "./mcp-poster-tools";

// MCP and OpenAI-style function tools share the same field validation. Convert
// nullable properties to JSON Schema's type array; avoid unsupported anyOf.
function toolSchema(value: unknown): Record<string, any> {
  const schema = structuredClone(value) as Record<string, any>;
  delete schema.$schema;
  if (schema.anyOf?.length === 2) {
    const real = schema.anyOf.find((entry: Record<string, unknown>) => entry.type !== "null");
    const nil = schema.anyOf.find((entry: Record<string, unknown>) => entry.type === "null");
    if (real && nil) {
      delete schema.anyOf;
      Object.assign(schema, real, { type: [real.type, "null"] });
    }
  }
  for (const [key, child] of Object.entries(schema)) {
    if (Array.isArray(child)) schema[key] = child.map(entry => entry && typeof entry === "object" ? toolSchema(entry) : entry);
    else if (child && typeof child === "object") schema[key] = toolSchema(child);
  }
  return schema;
}

export const posterPatchInputSchema = toolSchema(z.toJSONSchema(posterPatchSchema));
const variants = PosterElementSchema.options.map(schema => toolSchema(z.toJSONSchema(schema)));
export const posterElementInputSchema = {
  type: "object", additionalProperties: false,
  required: ["id", "name", "type", "x", "y", "width", "height"],
  properties: {
    ...Object.assign({}, ...variants.map(schema => schema.properties)),
    type: { type: "string", enum: ["text", "rect", "ellipse", "path", "image"], description: "text additionally requires text, fill, fontSize, fontFamily, fontWeight and textAlign; rect/ellipse require fill; path requires fill and path; image requires resourceId from this memo. No arbitrary URLs or unknown type-specific properties." },
  },
};
export const posterOperationsInputSchema = {
  type: "array", minItems: 1, maxItems: 100,
  items: {
    type: "object", required: ["op"], additionalProperties: false,
    properties: {
      op: { type: "string", enum: ["add", "remove", "duplicate", "reorder", "group", "ungroup", "align", "lock", "apply_template"] },
      element: posterElementInputSchema,
      ids: { type: "array", minItems: 1, maxItems: 100, uniqueItems: true, items: { type: "string", minLength: 1 } },
      dx: { type: "number", minimum: -8192, maximum: 8192 }, dy: { type: "number", minimum: -8192, maximum: 8192 },
      position: { type: "string", enum: ["front", "back", "forward", "backward"] },
      alignment: { type: "string", enum: ["left", "center", "right", "top", "middle", "bottom"] },
      locked: { type: "boolean" }, template: { type: "string", enum: [...POSTER_TEMPLATES] },
      heading: { type: "string", minLength: 1, maxLength: 80 }, subtitle: { type: "string", maxLength: 240 },
    },
  },
};
