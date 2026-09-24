import type { TiptapDoc } from "@edgeever/shared";

export const STAGED_RESOURCE_URL_PREFIX = "edgeever-staged://";

export type StagedResourceReference = {
  stagedId: string;
  filename: string | null;
};

export type RepairableMemoResource = {
  url: string;
  filename?: string | null;
  kind?: string | null;
  mimeType?: string | null;
  byteSize?: number;
};

const STAGED_RESOURCE_ID_CHARACTER = /[A-Za-z0-9_-]/;

export const stagedResourceIdFromUrl = (url: string): string | null => {
  if (!url.startsWith(STAGED_RESOURCE_URL_PREFIX)) return null;
  try {
    const parsed = new URL(url);
    const id = decodeURIComponent(parsed.hostname || parsed.pathname.replace(/^\//, ""));
    return id || null;
  } catch {
    const id = url.slice(STAGED_RESOURCE_URL_PREFIX.length).split(/[/?#]/, 1)[0];
    return id || null;
  }
};

export const contentReferencesStagedResourceUrl = (value: unknown): boolean => {
  if (typeof value === "string") return value.includes(STAGED_RESOURCE_URL_PREFIX);
  if (Array.isArray(value)) return value.some(contentReferencesStagedResourceUrl);
  if (value && typeof value === "object") {
    return Object.values(value).some(contentReferencesStagedResourceUrl);
  }
  return false;
};

const addStagedReference = (
  references: StagedResourceReference[],
  stagedId: string,
  filename: string | null,
) => {
  const existing = references.find((reference) => reference.stagedId === stagedId);
  const normalizedFilename = filename?.trim() || null;
  if (!existing) {
    references.push({ stagedId, filename: normalizedFilename });
    return;
  }
  if (!existing.filename && normalizedFilename) existing.filename = normalizedFilename;
};

const collectFromString = (value: string, references: StagedResourceReference[]) => {
  for (const match of value.matchAll(/!\[([^\]]*)\]\(edgeever-staged:\/\/([A-Za-z0-9_-]+)\)/g)) {
    addStagedReference(references, match[2], match[1] || null);
  }
  for (const match of value.matchAll(/edgeever-staged:\/\/([A-Za-z0-9_-]+)/g)) {
    addStagedReference(references, match[1], null);
  }
};

const filenameFromNode = (node: Record<string, unknown>) => {
  for (const key of ["alt", "title", "filename", "label"]) {
    const value = node[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  const attrs = node.attrs;
  if (attrs && typeof attrs === "object") return filenameFromNode(attrs as Record<string, unknown>);
  return null;
};

export const collectStagedResourceReferences = (value: unknown): StagedResourceReference[] => {
  const references: StagedResourceReference[] = [];
  const visit = (node: unknown) => {
    if (typeof node === "string") {
      collectFromString(node, references);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    for (const key of ["src", "href", "url"]) {
      const candidate = record[key];
      if (typeof candidate !== "string") continue;
      const stagedId = stagedResourceIdFromUrl(candidate);
      if (stagedId) addStagedReference(references, stagedId, filenameFromNode(record));
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return references;
};

export const findMatchingMemoResource = (
  resources: RepairableMemoResource[],
  filename?: string | null,
  kind?: string | null,
) => {
  const pool = kind ? resources.filter((resource) => resource.kind === kind) : resources;
  const normalizedFilename = filename?.trim();
  if (normalizedFilename) {
    const named = pool.filter((resource) => resource.filename === normalizedFilename);
    if (named.length === 1) return named[0];
    if (named.length > 1) return null;
    // Image compression may change only the extension (for example, .jpg to
    // .webp) while the editor keeps the original filename as the image alt.
    const stem = normalizedFilename.replace(/\.[^.]+$/, "");
    const sameStem = pool.filter((resource) => resource.filename?.replace(/\.[^.]+$/, "") === stem);
    return sameStem.length === 1 ? sameStem[0] : null;
  }
  if (pool.length === 1) return pool[0];
  return null;
};

export const resolveStagedResourceRewriteUrl = (
  reference: StagedResourceReference,
  resources: RepairableMemoResource[],
  liveStagedIds?: ReadonlySet<string>,
) => {
  if (liveStagedIds?.has(reference.stagedId)) return null;
  return findMatchingMemoResource(resources, reference.filename, "image")?.url
    ?? findMatchingMemoResource(resources, reference.filename)?.url
    ?? null;
};

export type StagedResourceUrlRewrite = { placeholder: string; url: string };

export const buildStagedResourceUrlRewrites = (
  value: unknown,
  resources: RepairableMemoResource[],
  liveStagedIds?: ReadonlySet<string>,
): StagedResourceUrlRewrite[] => {
  const rewrites: StagedResourceUrlRewrite[] = [];
  const seen = new Set<string>();
  for (const reference of collectStagedResourceReferences(value)) {
    if (seen.has(reference.stagedId)) continue;
    const url = resolveStagedResourceRewriteUrl(reference, resources, liveStagedIds);
    if (!url) continue;
    seen.add(reference.stagedId);
    rewrites.push({
      placeholder: `${STAGED_RESOURCE_URL_PREFIX}${reference.stagedId}`,
      url,
    });
  }
  return rewrites;
};

const rewriteStagedUrlString = (value: string, rewrite: StagedResourceUrlRewrite) => {
  let index = value.indexOf(rewrite.placeholder);
  if (index < 0) return value;
  let current = value;
  while (index >= 0) {
    const nextCharacter = current[index + rewrite.placeholder.length];
    if (!nextCharacter || !STAGED_RESOURCE_ID_CHARACTER.test(nextCharacter)) {
      current = `${current.slice(0, index)}${rewrite.url}${current.slice(index + rewrite.placeholder.length)}`;
      index = current.indexOf(rewrite.placeholder, index + rewrite.url.length);
      continue;
    }
    index = current.indexOf(rewrite.placeholder, index + rewrite.placeholder.length);
  }
  return current;
};

export const applyStagedResourceUrlRewrites = (
  value: unknown,
  rewrites: StagedResourceUrlRewrite[],
): unknown => {
  if (rewrites.length === 0) return value;
  if (typeof value === "string") {
    return rewrites.reduce((current, rewrite) => rewriteStagedUrlString(current, rewrite), value);
  }
  if (Array.isArray(value)) return value.map((item) => applyStagedResourceUrlRewrites(item, rewrites));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, applyStagedResourceUrlRewrites(item, rewrites)]),
    );
  }
  return value;
};

export const repairMemoStagedResourceUrls = <T extends { contentJson?: unknown; contentMarkdown?: string | null }>(
  memo: T,
  resources: RepairableMemoResource[],
  liveStagedIds?: ReadonlySet<string>,
): T => {
  if (
    !contentReferencesStagedResourceUrl(memo.contentJson)
    && !contentReferencesStagedResourceUrl(memo.contentMarkdown)
  ) {
    return memo;
  }
  const rewrites = buildStagedResourceUrlRewrites(
    { contentJson: memo.contentJson, contentMarkdown: memo.contentMarkdown },
    resources,
    liveStagedIds,
  );
  if (rewrites.length === 0) return memo;
  return {
    ...memo,
    contentJson: applyStagedResourceUrlRewrites(memo.contentJson, rewrites) as T["contentJson"],
    contentMarkdown: typeof memo.contentMarkdown === "string"
      ? applyStagedResourceUrlRewrites(memo.contentMarkdown, rewrites) as string
      : memo.contentMarkdown,
  };
};

export const repairTiptapStagedResourceUrls = (
  doc: TiptapDoc,
  resources: RepairableMemoResource[],
  liveStagedIds?: ReadonlySet<string>,
) => repairMemoStagedResourceUrls({ contentJson: doc }, resources, liveStagedIds).contentJson as TiptapDoc;
