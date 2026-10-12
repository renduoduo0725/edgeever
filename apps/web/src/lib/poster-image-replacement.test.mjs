import { expect, test } from "bun:test";
import { createPosterDocument, parsePosterDocument, serializePosterDocument } from "@edgeever/shared";
import { posterImageReplacementTarget, replacePosterImage } from "./poster-image-replacement";

const placeholder = { id: "design_1", name: "Photo", type: "rect", x: 500, y: 60, width: 320, height: 320, fill: "#16a06e", rotation: 0, opacity: 1, imagePlaceholder: true };
const doc = () => ({ ...createPosterDocument("Title"), elements: [placeholder] });
test("only images and declared placeholders offer replacement, including legacy slots", () => {
  const document = doc();
  expect(posterImageReplacementTarget(document, placeholder.id).id).toBe(placeholder.id);
  expect(posterImageReplacementTarget({ ...document, elements: [{ ...placeholder, imagePlaceholder: undefined }] }, placeholder.id)).toBeUndefined();
  const slot = { x: 500, y: 60, width: 320, height: 320 };
  expect(posterImageReplacementTarget({ ...document, elements: [{ ...placeholder, imagePlaceholder: undefined }] }, placeholder.id, undefined, slot).id).toBe(placeholder.id);
  for (const patch of [{ locked: true }, { visible: false }]) expect(posterImageReplacementTarget({ ...document, elements: [{ ...placeholder, ...patch }] }, placeholder.id)).toBeUndefined();
  const heading = createPosterDocument("Title").elements.find(element => element.type === "text");
  expect(posterImageReplacementTarget({ ...document, elements: [placeholder, heading] }, heading.id, { x: 600, y: 100 })).toBeUndefined();
  const glow = { ...placeholder, id: "design_2", type: "ellipse", imagePlaceholder: undefined };
  expect(posterImageReplacementTarget({ ...document, elements: [placeholder, glow] }, glow.id, { x: 600, y: 100 }).id).toBe(placeholder.id);
  expect(posterImageReplacementTarget({ ...document, elements: [placeholder, glow] }, glow.id, { x: 10, y: 10 })).toBeUndefined();
});

test("replacements retain geometry and layer identity, use centered cover crops and round-trip", () => {
  const replacement = replacePosterImage(placeholder, "photo", 1600, 900);
  expect(replacement).toMatchObject({ id: placeholder.id, type: "image", x: 500, y: 60, width: 320, height: 320, crop: { x: 0.21875, y: 0, width: 0.5625, height: 1 } });
  const glow = { ...placeholder, id: "design_2", type: "ellipse", imagePlaceholder: undefined };
  expect(posterImageReplacementTarget({ ...doc(), elements: [replacement, glow] }, glow.id, { x: 600, y: 100 }).id).toBe(replacement.id);
  expect(replacement.imagePlaceholder).toBeUndefined();
  expect(replacement.fill).toBeUndefined();
  const document = { ...doc(), elements: [replacement] };
  expect(parsePosterDocument(serializePosterDocument(document))).toEqual(document);
  expect(posterImageReplacementTarget(document, replacement.id).id).toBe(placeholder.id);
  const cropped = { ...replacement, rotation: 20, crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 } };
  expect(replacePosterImage(cropped, "second", 900, 1600)).toMatchObject({ crop: cropped.crop, rotation: 20 });
  expect(() => replacePosterImage({ ...placeholder, locked: true }, "photo", 1600, 900)).toThrow();
  expect(parsePosterDocument(serializePosterDocument(doc())).elements[0].imagePlaceholder).toBe(true);
});
