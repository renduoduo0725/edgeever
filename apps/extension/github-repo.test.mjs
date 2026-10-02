import { describe, expect, test } from "bun:test";
import {
  cleanRepoDescription,
  githubRepoFactsFromSource,
  githubRepoNoteMarkdown,
  githubRepoNoteTitle,
  githubRepoTarget,
  readmeLead,
} from "./src/github-repo.ts";

const labels = {
  capturedAt: "2026-10-01T00:00:00.000Z",
  sourceLabel: "来源",
  capturedAtLabel: "抓取时间",
  homepageLabel: "主页",
  languageLabel: "语言",
  licenseLabel: "许可证",
  topicsLabel: "话题",
};

const source = (overrides = {}) => ({
  pageUrl: "https://github.com/tianma-if/edgeever",
  openGraphDescription: "",
  embeddedJsonChunks: [],
  aboutText: "",
  homepage: "",
  topics: [],
  license: "",
  language: "",
  readmeParagraphs: [],
  ...overrides,
});

const sidebarPayload = (overrides = {}) => JSON.stringify({
  payload: {
    sidebarAbout: {
      description: "Open-source, AI-native knowledge base.",
      website: "https://edgeever.org",
      topics: [{ name: "notes" }, { name: "mcp" }, { name: "notes" }],
      ownerLogin: "tianma-if",
      repoName: "edgeever",
      stargazerCount: 1915,
      forksCount: 995,
      repo: { license: { spdxId: "AGPL-3.0", name: "GNU Affero General Public License v3.0" } },
      ...overrides,
    },
  },
});

describe("github repository addresses", () => {
  test("accepts a repository home and a code tree, and ignores other GitHub pages", () => {
    expect(githubRepoTarget("https://github.com/tianma-if/edgeever")).toEqual({
      owner: "tianma-if",
      name: "edgeever",
      canonicalUrl: "https://github.com/tianma-if/edgeever",
    });
    expect(githubRepoTarget("https://www.github.com/tianma-if/edgeever/?tab=readme-ov-file#readme")?.canonicalUrl)
      .toBe("https://github.com/tianma-if/edgeever");
    expect(githubRepoTarget("https://github.com/tianma-if/edgeever/tree/main")?.canonicalUrl)
      .toBe("https://github.com/tianma-if/edgeever");
    expect(githubRepoTarget("https://github.com/tianma-if/edgeever/tree/release/1.0/apps")?.canonicalUrl)
      .toBe("https://github.com/tianma-if/edgeever");
    expect(githubRepoTarget("https://github.com/tianma-if/edgeever/issues/12")).toBeNull();
    expect(githubRepoTarget("https://github.com/tianma-if/edgeever/pull/4")).toBeNull();
    expect(githubRepoTarget("https://github.com/tianma-if/edgeever/blob/main/README.md")).toBeNull();
    expect(githubRepoTarget("https://github.com/tianma-if/edgeever/tree")).toBeNull();
    expect(githubRepoTarget("https://github.com/tianma-if")).toBeNull();
    expect(githubRepoTarget("https://gist.github.com/tianma-if/edgeever")).toBeNull();
    expect(githubRepoTarget("https://example.com/tianma-if/edgeever")).toBeNull();
  });
});

describe("github repository card", () => {
  test("drops GitHub's generated description and the repository suffix", () => {
    expect(cleanRepoDescription(
      "Open-source notes. - tianma-if/edgeever",
      "tianma-if",
      "edgeever",
    )).toBe("Open-source notes.");
    expect(cleanRepoDescription(
      "Open-source notes &amp; sync. - edgeever/apps at main · tianma-if/edgeever",
      "tianma-if",
      "edgeever",
    )).toBe("Open-source notes & sync.");
    expect(cleanRepoDescription(
      "Contribute to tianma-if/edgeever development by creating an account on GitHub.",
      "tianma-if",
      "edgeever",
    )).toBe("");
  });

  test("uses the first real README paragraph when the about text is empty", () => {
    expect(readmeLead(["", "ok", "This is the project introduction."])).toBe("This is the project introduction.");
    expect(readmeLead(["字".repeat(900)]).endsWith("…")).toBe(true);
    expect(readmeLead(["字".repeat(900)]).length).toBe(801);
  });

  test("builds a card from the repository payload and leaves out live counters", () => {
    const facts = githubRepoFactsFromSource(source({
      pageUrl: "https://github.com/Tianma-IF/EdgeEver/tree/main/apps",
      openGraphDescription: "Open-source, AI-native knowledge base. - tianma-if/edgeever",
      embeddedJsonChunks: [sidebarPayload()],
      language: "TypeScript 62.1%",
      topics: ["notes", "sqlite"],
    }));
    expect(facts).toMatchObject({
      owner: "tianma-if",
      name: "edgeever",
      canonicalUrl: "https://github.com/tianma-if/edgeever",
      intro: "Open-source, AI-native knowledge base.",
      homepage: "https://edgeever.org/",
      language: "TypeScript",
      license: "AGPL-3.0",
      topics: ["notes", "mcp", "sqlite"],
    });
    const markdown = githubRepoNoteMarkdown({ ...facts, ...labels });
    expect(githubRepoNoteTitle(facts.owner, facts.name)).toBe("tianma-if/edgeever");
    expect(markdown.startsWith("Open-source, AI-native knowledge base.")).toBe(true);
    expect(markdown).toContain("主页: [edgeever.org](https://edgeever.org/)");
    expect(markdown).toContain("语言: TypeScript");
    expect(markdown).toContain("许可证: AGPL-3.0");
    expect(markdown).toContain("话题: notes, mcp, sqlite");
    expect(markdown).toContain("[https://github.com/tianma-if/edgeever](https://github.com/tianma-if/edgeever)");
    expect(markdown).toContain("抓取时间: 2026-10-01T00:00:00.000Z");
    expect(markdown).not.toContain("1915");
    expect(markdown).not.toContain("995");
  });

  test("reads a code tree that only identifies the repository, then uses the README lead", () => {
    const facts = githubRepoFactsFromSource(source({
      pageUrl: "https://github.com/tianma-if/edgeever/tree/main",
      openGraphDescription: "Contribute to tianma-if/edgeever development by creating an account on GitHub.",
      embeddedJsonChunks: [JSON.stringify({
        payload: {
          codeViewLayoutRoute: {
            repo: { ownerLogin: "tianma-if", name: "edgeever", defaultBranch: "main" },
          },
        },
      })],
      readmeParagraphs: ["Go", "A portable notes workspace for long-term writing."],
    }));
    expect(facts?.intro).toBe("A portable notes workspace for long-term writing.");
    expect(facts?.homepage).toBe("");
    expect(facts?.topics).toEqual([]);
    const markdown = githubRepoNoteMarkdown({ ...facts, ...labels });
    expect(markdown).not.toContain("主页:");
    expect(markdown).not.toContain("话题:");
    expect(markdown).toContain("来源: [https://github.com/tianma-if/edgeever](https://github.com/tianma-if/edgeever)");
  });

  test("does not treat an unrelated GitHub page as the repository in the address", () => {
    expect(githubRepoFactsFromSource(source({
      pageUrl: "https://github.com/features/copilot",
      openGraphDescription: "AI pair programmer.",
      embeddedJsonChunks: [sidebarPayload()],
    }))).toBeNull();
    expect(githubRepoFactsFromSource(source({
      pageUrl: "https://github.com/tianma-if/edgeever/issues/8",
      embeddedJsonChunks: [sidebarPayload()],
    }))).toBeNull();
  });
});
