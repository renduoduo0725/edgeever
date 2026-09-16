export const isDesktopViewport = () => window.matchMedia("(min-width: 1024px)").matches;
export const PULL_TO_REFRESH_TRIGGER_PX = 72;
export const PULL_TO_REFRESH_MAX_PX = 96;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

export const runWorkspaceViewTransition = (update: () => void) => {
  const viewTransitionDocument = document as ViewTransitionDocument;

  if (
    !viewTransitionDocument.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    update();
    return;
  }

  viewTransitionDocument.startViewTransition(update);
};

export const isStandaloneApp = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

export const getVerticalScrollContainer = (target: EventTarget | null) => {
  let element = target instanceof HTMLElement ? target : null;

  while (element && element !== document.body) {
    const style = window.getComputedStyle(element);
    const canScroll = /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;

    if (canScroll) {
      return element;
    }

    element = element.parentElement;
  }

  return null;
};
