export const RENDERER_HIBERNATE_BACKGROUND_MS = 10 * 60 * 1000;
export const RENDERER_HIBERNATE_MEMORY_BACKGROUND_MS = 45 * 1000;
export const RENDERER_HIBERNATE_MEMORY_BYTES = 800 * 1024 * 1024;
export const RENDERER_HIBERNATE_PREPARE_TIMEOUT_MS = 2_000;

export const workingSetBytesFromProcessMemoryInfo = (info = {}) => {
  const kilobytes = Number(info.private) || Number(info.residentSet) || 0;
  return kilobytes > 0 ? kilobytes * 1024 : 0;
};

export const shouldHibernateRenderer = ({
  focused = false,
  visible = true,
  quitting = false,
  loading = false,
  inFlight = false,
  backgroundMs = 0,
  workingSetBytes = 0,
} = {}) => {
  if (focused || quitting || loading || inFlight) return false;
  if (backgroundMs >= RENDERER_HIBERNATE_MEMORY_BACKGROUND_MS && !visible && workingSetBytes >= RENDERER_HIBERNATE_MEMORY_BYTES) {
    return true;
  }
  if (backgroundMs >= RENDERER_HIBERNATE_BACKGROUND_MS && (!visible || workingSetBytes >= RENDERER_HIBERNATE_MEMORY_BYTES)) {
    return true;
  }
  return false;
};

export const nextHibernateCheckDelayMs = (backgroundMs = 0) => {
  if (backgroundMs < RENDERER_HIBERNATE_MEMORY_BACKGROUND_MS) {
    return RENDERER_HIBERNATE_MEMORY_BACKGROUND_MS - backgroundMs;
  }
  if (backgroundMs < RENDERER_HIBERNATE_BACKGROUND_MS) {
    return RENDERER_HIBERNATE_BACKGROUND_MS - backgroundMs;
  }
  return RENDERER_HIBERNATE_BACKGROUND_MS;
};

export const createRendererHibernateController = ({
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  getBackgroundState,
  getMemoryBytes,
  prepareRenderer,
  reloadRenderer,
  onDiagnostic,
} = {}) => {
  let backgroundAt = null;
  let timer = null;
  let inFlight = false;

  const clearScheduledCheck = () => {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  };

  const cancel = () => {
    backgroundAt = null;
    clearScheduledCheck();
  };

  const scheduleCheck = (delayMs) => {
    clearScheduledCheck();
    timer = setTimer(() => {
      timer = null;
      return tick();
    }, Math.max(0, delayMs));
  };

  const tick = async () => {
    const state = getBackgroundState?.() ?? {};
    if (state.focused) {
      cancel();
      return;
    }
    if (backgroundAt === null) backgroundAt = now();
    const backgroundMs = Math.max(0, now() - backgroundAt);
    const workingSetBytes = await Promise.resolve(getMemoryBytes?.() ?? 0).catch(() => 0);
    const shouldHibernate = shouldHibernateRenderer({
      ...state,
      inFlight,
      backgroundMs,
      workingSetBytes,
    });
    if (!shouldHibernate) {
      if (!state.focused && !state.quitting) scheduleCheck(nextHibernateCheckDelayMs(backgroundMs));
      return;
    }

    inFlight = true;
    clearScheduledCheck();
    onDiagnostic?.("renderer.hibernate-prepare", { backgroundMs, workingSetBytes, visible: state.visible });
    try {
      await Promise.resolve(prepareRenderer?.());
      if (getBackgroundState?.().focused || getBackgroundState?.().quitting) return;
      onDiagnostic?.("renderer.hibernate-reload", { backgroundMs, workingSetBytes });
      await Promise.resolve(reloadRenderer?.());
    } finally {
      inFlight = false;
      backgroundAt = null;
    }
  };

  const noteBackground = () => {
    const state = getBackgroundState?.() ?? {};
    if (state.focused || state.quitting) {
      cancel();
      return;
    }
    if (backgroundAt === null) backgroundAt = now();
    if (timer === null) scheduleCheck(nextHibernateCheckDelayMs(now() - backgroundAt));
  };

  return {
    cancel,
    noteBackground,
    isInFlight: () => inFlight,
  };
};
