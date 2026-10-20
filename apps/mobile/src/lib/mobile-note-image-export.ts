export { planNativeNoteImageRender as planMobileNoteImageRender } from "@edgeever/shared/note-image-card";

// Expo's path joiner escapes spaces and percent signs, but leaves brackets raw.
// Android's java.net.URI rejects those in a path. Escape only brackets here so
// existing percent escapes stay intact and the actual filename is preserved.
export const encodeMobileNoteImageFileUri = (uri: string): string =>
  uri.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
