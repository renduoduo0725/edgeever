const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);
const NAME = /^[A-Za-z0-9_.-]+$/;

export type GithubRepoTarget = {
  owner: string;
  name: string;
  canonicalUrl: string;
};

export type GithubRepoPageSource = {
  pageUrl: string;
  openGraphDescription: string;
  embeddedJsonChunks: string[];
  aboutText: string;
  homepage: string;
  topics: string[];
  license: string;
  language: string;
  readmeParagraphs: string[];
};

export type GithubRepoFacts = {
  owner: string;
  name: string;
  canonicalUrl: string;
  intro: string;
  homepage: string;
  language: string;
  license: string;
  topics: string[];
};

const decodePathSegment = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const sameName = (left: string, right: string) => left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;

const readString = (value: unknown) => typeof value === "string" ? value.trim() : "";

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const decodeEntities = (value: string) => value
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&#39;/g, "'");

const collapse = (value: string) => decodeEntities(value).replace(/\s+/g, " ").trim();

export const githubRepoTarget = (pageUrl: string): GithubRepoTarget | null => {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return null;
  const parts = url.pathname.split("/").filter(Boolean).map(decodePathSegment);
  if (parts.length < 2) return null;
  const [owner, name, section, ...rest] = parts;
  if (!owner || !name || !NAME.test(owner) || !NAME.test(name)) return null;
  if (section && section !== "tree") return null;
  if (section === "tree" && rest.length === 0) return null;
  return {
    owner,
    name,
    canonicalUrl: `https://github.com/${owner}/${name}`,
  };
};

export const cleanRepoDescription = (value: string, owner: string, name: string) => {
  let text = collapse(value);
  if (!text || !owner || !name) return text;
  const ownerName = `${escapeRegExp(owner)}/${escapeRegExp(name)}`;
  text = text
    .replace(new RegExp(`\\s+-\\s+.+\\s+at\\s+.+\\s+·\\s+${ownerName}\\s*$`, "i"), "")
    .replace(new RegExp(`\\s+-\\s+${ownerName}\\s*$`, "i"), "")
    .trim();
  if (new RegExp(`^contribute to (?:${ownerName}\\s+)?development by creating an account on github\\.?$`, "i").test(text)) {
    return "";
  }
  return text;
};

export const readmeLead = (paragraphs: readonly string[]) => {
  for (const paragraph of paragraphs) {
    const text = collapse(paragraph);
    if (text.length < 8 || !/[\p{L}\p{N}]/u.test(text)) continue;
    return text.length > 800 ? `${text.slice(0, 800).trimEnd()}…` : text;
  }
  return "";
};

const licenseText = (value: unknown) => {
  const record = asRecord(value);
  if (!record) return "";
  return readString(record.spdxId) || readString(record.name);
};

const topicNames = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const item of value) {
    const name = typeof item === "string" ? item.trim() : readString(asRecord(item)?.name);
    if (name) names.push(name);
  }
  return names;
};

type EmbeddedRepo = {
  owner: string;
  name: string;
  description: string;
  homepage: string;
  license: string;
  topics: string[];
};

const embeddedRepoRecords = (value: unknown) => {
  const records: EmbeddedRepo[] = [];
  const visit = (node: unknown, depth: number) => {
    if (depth > 10 || node == null) return;
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 40)) visit(item, depth + 1);
      return;
    }
    const record = asRecord(node);
    if (!record) return;
    const owner = readString(record.ownerLogin);
    const name = readString(record.repoName) || readString(record.name);
    const nestedRepo = asRecord(record.repo);
    const license = licenseText(record.license) || licenseText(nestedRepo?.license);
    const description = readString(record.description);
    const homepage = readString(record.website);
    const topics = topicNames(record.topics);
    const repoShaped = Boolean(owner && name && (
      description
      || homepage
      || topics.length
      || license
      || readString(record.defaultBranch)
    ));
    if (repoShaped) {
      records.push({ owner, name, description, homepage, license, topics });
    }
    for (const child of Object.values(record)) {
      if (child && typeof child === "object") visit(child, depth + 1);
    }
  };
  visit(value, 0);
  return records;
};

const normalizeHomepage = (value: string) => {
  const text = value.trim();
  if (!text) return "";
  const withScheme = /^https?:\/\//i.test(text)
    ? text
    : /^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(text)
      ? `https://${text}`
      : "";
  if (!withScheme) return "";
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
};

const cleanLicense = (value: string) => collapse(value).replace(/\s+license$/i, "").trim().slice(0, 80);

const cleanLanguage = (value: string) => {
  const text = collapse(value).replace(/\s+\d+(?:\.\d+)?%$/, "").trim();
  if (!text || text.length > 40 || /%$/.test(text) || /^languages?$/i.test(text)) return "";
  return text;
};

const dedupeTopics = (values: readonly string[]) => {
  const topics: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const topic = collapse(value).slice(0, 50);
    const key = topic.toLowerCase();
    if (!topic || seen.has(key)) continue;
    seen.add(key);
    topics.push(topic);
    if (topics.length >= 30) break;
  }
  return topics;
};

const firstText = (values: readonly string[]) => values.map((value) => value.trim()).find(Boolean) ?? "";

export const githubRepoFactsFromSource = (source: GithubRepoPageSource): GithubRepoFacts | null => {
  const target = githubRepoTarget(source.pageUrl);
  if (!target) return null;
  const records: EmbeddedRepo[] = [];
  for (const chunk of source.embeddedJsonChunks) {
    try {
      records.push(...embeddedRepoRecords(JSON.parse(chunk)));
    } catch {
      // A GitHub page can carry unrelated JSON beside the repository payload.
    }
  }
  const matched = records.filter((record) => sameName(record.owner, target.owner) && sameName(record.name, target.name));
  if (matched.length === 0) return null;
  const richest = matched.find((record) => record.description || record.topics.length || record.homepage) ?? matched[0];
  if (!richest) return null;
  const owner = richest.owner;
  const name = richest.name;
  const description = [
    ...matched.map((record) => record.description),
    source.aboutText,
    source.openGraphDescription,
  ].map((value) => cleanRepoDescription(value, owner, name)).find(Boolean) ?? "";
  return {
    owner,
    name,
    canonicalUrl: `https://github.com/${owner}/${name}`,
    intro: description || readmeLead(source.readmeParagraphs),
    homepage: normalizeHomepage(firstText([...matched.map((record) => record.homepage), source.homepage])),
    language: cleanLanguage(source.language),
    license: cleanLicense(firstText([...matched.map((record) => record.license), source.license])),
    topics: dedupeTopics([...matched.flatMap((record) => record.topics), ...source.topics]),
  };
};

const escapeMarkdownText = (value: string) =>
  value.replace(/[\r\n]+/g, " ").replace(/\\/g, "\\\\").replace(/([*_`[\]])/g, "\\$1");

const markdownDestination = (value: string) =>
  value.replace(/\\/g, "%5C").replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");

const homepageLabelText = (value: string) => value.replace(/^https?:\/\//i, "").replace(/\/$/, "");

export const githubRepoNoteTitle = (owner: string, name: string) => `${owner}/${name}`.slice(0, 120);

export const githubRepoNoteMarkdown = (input: {
  canonicalUrl: string;
  intro: string;
  homepage: string;
  language: string;
  license: string;
  topics: readonly string[];
  capturedAt: string;
  sourceLabel: string;
  capturedAtLabel: string;
  homepageLabel: string;
  languageLabel: string;
  licenseLabel: string;
  topicsLabel: string;
}) => {
  const lines: string[] = [];
  const intro = escapeMarkdownText(input.intro);
  if (intro) lines.push(intro);
  if (input.homepage) {
    lines.push(`${escapeMarkdownText(input.homepageLabel)}: [${escapeMarkdownText(homepageLabelText(input.homepage))}](${markdownDestination(input.homepage)})`);
  }
  if (input.language) lines.push(`${escapeMarkdownText(input.languageLabel)}: ${escapeMarkdownText(input.language)}`);
  if (input.license) lines.push(`${escapeMarkdownText(input.licenseLabel)}: ${escapeMarkdownText(input.license)}`);
  if (input.topics.length) {
    lines.push(`${escapeMarkdownText(input.topicsLabel)}: ${input.topics.map((topic) => escapeMarkdownText(topic)).join(", ")}`);
  }
  lines.push(`${escapeMarkdownText(input.sourceLabel)}: [${escapeMarkdownText(input.canonicalUrl)}](${markdownDestination(input.canonicalUrl)})`);
  lines.push(`${escapeMarkdownText(input.capturedAtLabel)}: ${input.capturedAt}`);
  return lines.join("\n\n");
};
