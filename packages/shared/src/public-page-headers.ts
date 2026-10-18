/**
 * Response headers for anonymous share and form links. The token in the URL is
 * the only secret, so these pages must stay out of search indexes, caches and
 * Referer headers sent to other sites.
 */
export const PUBLIC_PAGE_ROBOTS = "noindex, nofollow, noarchive, nosnippet, noimageindex";

export const PUBLIC_PAGE_HEADERS: Readonly<Record<string, string>> = {
  "X-Robots-Tag": PUBLIC_PAGE_ROBOTS,
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};

/** Web routes rendered for anonymous visitors of a share or form link. */
export const isPublicPagePath = (pathname: string) =>
  pathname.startsWith("/share/") || pathname.startsWith("/form/");
