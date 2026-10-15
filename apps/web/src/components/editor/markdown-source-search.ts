import { SearchQuery } from "@codemirror/search";
import { Text } from "@codemirror/state";
import type { NoteSearchMatch } from "./note-search";

export const getMarkdownSearchMatches = (source: string | Text, query: string): NoteSearchMatch[] => {
  if (!query.length) return [];
  const doc = typeof source === "string" ? Text.of(source.split("\n")) : source;
  const cursor = new SearchQuery({ search: query, literal: true, caseSensitive: false }).getCursor(doc);
  const matches: NoteSearchMatch[] = [];
  for (let next = cursor.next(); !next.done; next = cursor.next()) {
    matches.push({ from: next.value.from, to: next.value.to });
  }
  return matches;
};

export const getMarkdownReplacementChanges = (source: string | Text, query: string, replacement: string) =>
  getMarkdownSearchMatches(source, query).map((match) => ({ ...match, insert: replacement }));
