export const isRevocableObjectUrl = (value: string) => value.startsWith("blob:");

const blankMediaElement = (element: { src?: string; removeAttribute?: (name: string) => void }) => {
  const src = typeof element.src === "string" ? element.src : "";
  element.removeAttribute?.("src");
  if ("src" in element) element.src = "";
  return src;
};

type MediaRoot = {
  querySelectorAll: (selector: string) => Iterable<Element>;
};

export const releaseHtmlMediaSources = (root: MediaRoot | null | undefined) => {
  if (!root) {
    return { images: 0, revoked: 0 };
  }

  let images = 0;
  let revoked = 0;

  for (const node of root.querySelectorAll("img")) {
    images += 1;
    const src = blankMediaElement(node as HTMLImageElement);
    if (isRevocableObjectUrl(src)) {
      URL.revokeObjectURL(src);
      revoked += 1;
    }
  }

  for (const node of root.querySelectorAll("iframe, embed, object, video, audio, source")) {
    blankMediaElement(node as HTMLImageElement);
  }

  for (const node of root.querySelectorAll("canvas")) {
    const canvas = node as HTMLCanvasElement;
    canvas.width = 0;
    canvas.height = 0;
  }

  return { images, revoked };
};
