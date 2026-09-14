export const PUBLISH_ORNAMENT_IDS = [
  "blossom",
  "sprig",
  "sun",
  "tape",
  "quote",
  "brush",
  "swoosh",
  "leaf",
] as const;
export type PublishOrnamentId = (typeof PUBLISH_ORNAMENT_IDS)[number];

const COLOR_TOKEN = "{{color}}";

const ORNAMENT_SVG: Record<PublishOrnamentId, string> = {
  blossom: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <g fill="${COLOR_TOKEN}">
      <path d="M16.2 3.6c1.6 2.4 1.8 5.4.4 7.8-1.6-1.1-3.6-1.6-5.6-1.2 1.1-2.8 2.9-5.1 5.2-6.6Z"/>
      <path d="M26.4 10.2c-1.3 2.6-3.6 4.4-6.3 5.1.3-1.9-.2-3.9-1.5-5.4 2.7-.8 5.3-.6 7.8.3Z"/>
      <path d="M24.8 22.8c-2.7.8-5.6.2-7.8-1.6 1.4-1.3 2.1-3.2 2-5.2 2.6 1.5 4.4 3.9 5.8 6.8Z"/>
      <path d="M8.6 24.4c-1.8-2.3-2.2-5.3-1-7.9 1.8.8 3.8.9 5.6.2-.4 2.9-1.8 5.5-4.6 7.7Z"/>
      <path d="M5.2 11.2c2.2-1.9 5.2-2.6 7.9-1.8-.9 1.7-1 3.7-.3 5.5-2.8-.3-5.5-1.5-7.6-3.7Z"/>
      <circle cx="16" cy="16" r="2.7"/>
    </g>
  </svg>`,
  sprig: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" fill="none">
    <path d="M18 46c.4-8.2 1.2-16.6-.2-24.6-1.6-9.2 2.4-16.4 8.8-21" stroke="${COLOR_TOKEN}" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    <path d="M17.6 28.2c-4.2-1.6-8.6.4-11.2 4.2 3.8.6 7.4-.4 11.2-4.2Z" fill="${COLOR_TOKEN}"/>
    <path d="M18.4 20.4c-3.2-3.4-3-8.4.6-11.6 2.8 3.4 3.2 7.8-.6 11.6Z" fill="${COLOR_TOKEN}"/>
    <path d="M20.2 14.2c2.8-3.8 7.8-5.2 12-3.2-2.2 4.2-6.6 6.2-12 3.2Z" fill="${COLOR_TOKEN}"/>
    <circle cx="27.4" cy="6.4" r="2.1" fill="${COLOR_TOKEN}"/>
  </svg>`,
  sun: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="5.1" fill="${COLOR_TOKEN}"/>
    <g stroke="${COLOR_TOKEN}" stroke-width="1.7" stroke-linecap="round">
      <path d="M16 3.4v3.4"/>
      <path d="M16 25.2v3.3"/>
      <path d="M3.5 16h3.4"/>
      <path d="M25.1 16h3.4"/>
      <path d="M6.6 6.7 9 9.1"/>
      <path d="M23 23l2.3 2.3"/>
      <path d="M25.3 6.7 23 9.1"/>
      <path d="M9 23 6.7 25.3"/>
    </g>
  </svg>`,
  tape: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 22" fill="none">
    <path d="M2.2 4.4 6 2.6l3.4 1.6 3.2-1.5 3.4 1.5 3.3-1.6 3.4 1.6 3.2-1.5 3.4 1.5 3.2-1.6 3.4 1.6 3.3-1.5 3.4 1.5 3.2-1.6 3.4 1.6 3.2-1.5 3.2 2.1-1.4 13.6-3.2 1.6-3.3-1.5-3.4 1.5-3.2-1.6-3.4 1.6-3.3-1.5-3.4 1.5-3.2-1.6-3.4 1.6-3.3-1.5-3.4 1.5-3.2-1.6-3.4 1.6-3.2-1.5-3.2-2.2Z" fill="${COLOR_TOKEN}" fill-opacity=".82"/>
    <path d="M8 8.2h48M8 13.6h48" stroke="#fff" stroke-opacity=".35" stroke-width="1" stroke-dasharray="2 3"/>
  </svg>`,
  quote: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 28" fill="none">
    <path fill="${COLOR_TOKEN}" d="M8.2 4.2C5.2 4.2 3 6.6 3 9.6c0 2.4 1.7 4.3 4.1 4.5-.7 2.8-2.4 5.5-4.7 8.1L7.2 24c2.8-3.4 5.2-7.6 5.2-12.2 0-4.6-1.6-7.6-4.2-7.6Zm16.8 0c-3 0-5.2 2.4-5.2 5.4 0 2.4 1.7 4.3 4.1 4.5-.7 2.8-2.4 5.5-4.7 8.1L24 24c2.8-3.4 5.2-7.6 5.2-12.2 0-4.6-1.6-7.6-4.2-7.6Z"/>
  </svg>`,
  brush: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 18" fill="none">
    <path d="M2 11.2c18-4.6 38-6.8 58-6.4 22 .4 40 3.4 62 3.1 12-.2 24-1.6 36-4.2-8 4.8-22 6.8-36 7.4-24 1-46-1.6-70-1.2-16 .2-32 1.8-48 4.8 0-1.2-.6-2.4-2-3.5Z" fill="${COLOR_TOKEN}"/>
  </svg>`,
  swoosh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 16" fill="none">
    <path d="M3 11.5c22-6.4 48-8.6 72-6.2 14 1.4 28 4.6 45 3.2" stroke="${COLOR_TOKEN}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  </svg>`,
  leaf: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" fill="none">
    <path d="M18 45.2c.6-8.8 1.8-16.6 8.8-25.4C33.6 12.2 32.4 5.4 27.2 2.8 21.2.2 13.6 3.2 8.6 11.4 3.2 20.4 7.8 31.6 18 45.2Z" fill="${COLOR_TOKEN}"/>
    <path d="M18 45.2c-1.2-10.4 1.6-19.2 6.4-27.6" stroke="#fff" stroke-opacity=".4" stroke-width="1.4" stroke-linecap="round" fill="none"/>
  </svg>`,
};

const compactSvg = (source: string) => source.replace(/\s+/g, " ").trim();

export const renderPublishOrnamentSvg = (id: PublishOrnamentId, color: string) => {
  const hex = /^#([0-9a-f]{6})$/i.test(color) ? color : "#111111";
  return compactSvg(ORNAMENT_SVG[id].replaceAll(COLOR_TOKEN, hex));
};

export const publishOrnamentDataUri = (id: PublishOrnamentId, color: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderPublishOrnamentSvg(id, color))}`;

export const publishOrnamentMaskUri = (id: PublishOrnamentId) => publishOrnamentDataUri(id, "#111111");

export type PublishOrnamentPlacement = {
  titleEnd?: PublishOrnamentId;
  titleRule?: PublishOrnamentId;
  chapterMark?: PublishOrnamentId;
  chapterEnd?: PublishOrnamentId;
  quoteMark?: PublishOrnamentId;
  quoteTape?: PublishOrnamentId;
  headingRule?: PublishOrnamentId;
};

export const PUBLISH_LAYOUT_ORNAMENTS: Record<string, PublishOrnamentPlacement> = {
  letter: {
    titleEnd: "sprig",
    titleRule: "brush",
    chapterMark: "blossom",
    chapterEnd: "sun",
    quoteMark: "quote",
    quoteTape: "tape",
  },
  grove: {
    headingRule: "swoosh",
    quoteMark: "quote",
    titleEnd: "leaf",
  },
  stub: {
    quoteTape: "tape",
  },
};

export const publishOrnamentCssVars = () => ({
  "--publish-ornament-blossom": `url("${publishOrnamentMaskUri("blossom")}")`,
  "--publish-ornament-sprig": `url("${publishOrnamentMaskUri("sprig")}")`,
  "--publish-ornament-sun": `url("${publishOrnamentMaskUri("sun")}")`,
  "--publish-ornament-tape": `url("${publishOrnamentMaskUri("tape")}")`,
  "--publish-ornament-quote": `url("${publishOrnamentMaskUri("quote")}")`,
  "--publish-ornament-brush": `url("${publishOrnamentMaskUri("brush")}")`,
  "--publish-ornament-swoosh": `url("${publishOrnamentMaskUri("swoosh")}")`,
  "--publish-ornament-leaf": `url("${publishOrnamentMaskUri("leaf")}")`,
});
