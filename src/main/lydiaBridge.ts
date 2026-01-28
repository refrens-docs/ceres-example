// Query params
const LYDIA_MODE_PARAM = "isLydiaMode";
const DEBUG_PARAM = "debugHeight";

// postMessage contract
const HEIGHT_MESSAGE_TYPE = "ceres:content-height";
const HEIGHT_MESSAGE_SOURCE = "ceres";

// Height calculation configuration
const PRINT_HEIGHT_BUFFER = 80;
const PARENT_HEIGHT_BUFFER = 0;
const HEIGHT_REPORT_DEBOUNCE_MS = 120;
const HEIGHT_CHANGE_THRESHOLD = 1;

type CleanupFn = () => void;

export interface LydiaBridgeOptions {
  outputElementId?: string;
}

export interface LydiaBridgeHandle {
  reportContentHeight: (reason?: string) => void;
  triggerPrint: (reason?: string) => void;
  destroy: () => void;
}

/**
 * Initializes the Ceres → Lydia bridge when `isLydiaMode=1` is present.
 *
 * Height reporting contract:
 * - Ceres posts `ceres:content-height` only after render or when layout changes.
 * - Updates are debounced and only sent when the height meaningfully changes.
 * - Lydia applies the reported height to the iframe.
 */
export function initLydiaBridge(
  options?: LydiaBridgeOptions
): LydiaBridgeHandle | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const lydiaModeEnabled = searchParams.get(LYDIA_MODE_PARAM);

  if (!lydiaModeEnabled) {
    return null;
  }

  const shouldDebug = searchParams.has(DEBUG_PARAM);
  const outputElementId = options?.outputElementId ?? "documentOutput";

  // Internal state
  let isPreparingForPrint = false;
  let hasSentHeight = false;
  let lastComputedHeight: number | null = null;
  let lastReportedHeight: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let heightReportTimer: number | null = null;
  let pendingReportReason: string | null = null;

  const cleanupFns: CleanupFn[] = [];

  // Logging (only when debug flag is enabled)
  const debugLog = (...args: unknown[]) => {
    if (!shouldDebug) {
      return;
    }
    console.debug("[CeresPrint]", ...args);
  };

  // DOM measurement helpers
  const computeFullHeight = (): number => {
    const { body, documentElement: docEl } = document;
    if (!body || !docEl) return 0;

    return Math.max(
      body.scrollHeight,
      docEl.scrollHeight,
      body.offsetHeight,
      docEl.offsetHeight,
      body.getBoundingClientRect().height,
      docEl.getBoundingClientRect().height
    );

  };

  // Messaging helpers
  const postHeightToParent = (fullHeight: number, reason = "resize") => {
    if (window.parent == null || window.parent === window) {
      return;
    }

    if (typeof window.parent.postMessage !== "function") {
      return;
    }

    if (!Number.isFinite(fullHeight)) {
      return;
    }

    const height = Math.ceil(fullHeight + PARENT_HEIGHT_BUFFER);

    if (lastReportedHeight === height && reason === "resize") {
      return;
    }

    lastReportedHeight = height;

    const payload = {
      source: HEIGHT_MESSAGE_SOURCE,
      type: HEIGHT_MESSAGE_TYPE,
      height,
      reason,
      timestamp: Date.now(),
    };

    window.parent.postMessage(payload, "*");
    debugLog("postHeightToParent", payload);
  };

  const measureAndReportHeight = (reason: string, force: boolean) => {
    const fullHeight = computeFullHeight();

    if (!Number.isFinite(fullHeight) || fullHeight <= 0) {
      return;
    }

    lastComputedHeight = fullHeight;

    const nextReportedHeight = Math.ceil(fullHeight + PARENT_HEIGHT_BUFFER);
    const shouldPost =
      force ||
      lastReportedHeight == null ||
      Math.abs(nextReportedHeight - lastReportedHeight) > HEIGHT_CHANGE_THRESHOLD;

    if (!shouldPost) {
      return;
    }

    hasSentHeight = true;
    postHeightToParent(fullHeight, reason);
    debugLog("reportContentHeight", { reason, fullHeight });
  };

  /**
   * Debounced height report. The double rAF ensures layout is settled before measurement.
   */
  const scheduleHeightReport = (reason = "resize", force = false) => {
    if (hasSentHeight && !force) {
      return;
    }

    pendingReportReason = reason;

    if (heightReportTimer) {
      window.clearTimeout(heightReportTimer);
    }

    heightReportTimer = window.setTimeout(() => {
      heightReportTimer = null;
      const reportReason = pendingReportReason ?? reason;
      pendingReportReason = null;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          measureAndReportHeight(reportReason, force);
        });
      });
    }, HEIGHT_REPORT_DEBOUNCE_MS);
  };

  // Print sizing helpers
  const enforceSizing = (fullHeight: number) => {
    const docEl = document.documentElement;
    const body = document.body;

    if (!docEl || !body) {
      return;
    }

    const targetHeight = fullHeight + PRINT_HEIGHT_BUFFER;
    lastComputedHeight = fullHeight;

    docEl.style.minHeight = `${targetHeight}px`;
    body.style.minHeight = `${targetHeight}px`;
  };

  /**
   * Applies print-friendly sizing. Uses min-height so content doesn't collapse.
   */
  const applyPrintSizing = (reason = "manual") => {
    const docEl = document.documentElement;
    const body = document.body;

    if (!docEl || !body) {
      return;
    }

    isPreparingForPrint = true;

    docEl.style.height = "auto";
    body.style.height = "auto";
    docEl.style.overflow = "visible";
    body.style.overflow = "visible";
    docEl.style.width = "auto";
    body.style.width = "auto";
    body.style.display = "block";
    body.style.alignItems = "stretch";

    const fullHeight = computeFullHeight();
    enforceSizing(fullHeight);

    debugLog("applyPrintSizing", { reason, fullHeight });
  };

  /**
   * Restores document sizing after printing.
   */
  const resetSizing = (reason = "manual") => {
    const docEl = document.documentElement;
    const body = document.body;

    if (!docEl || !body) {
      return;
    }

    isPreparingForPrint = false;

    docEl.style.removeProperty("min-height");
    body.style.removeProperty("min-height");
    docEl.style.removeProperty("height");
    body.style.removeProperty("height");
    docEl.style.removeProperty("overflow");
    body.style.removeProperty("overflow");
    docEl.style.removeProperty("width");
    body.style.removeProperty("width");
    body.style.removeProperty("display");
    body.style.removeProperty("align-items");

    debugLog("resetSizing", { reason });
  };

  const triggerPrintInternal = (reason = "manual") => {
    applyPrintSizing(reason);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        debugLog("triggerIframePrint", { reason, height: lastComputedHeight });
        window.print();
      });
    });
  };

  /**
   * Public API used by the renderer to report a stable height once rendering finishes.
   * This is debounced and will only post if height changed.
   */
  const reportContentHeight = (reason = "render-complete") => {
    scheduleHeightReport(reason, true);
  };

  const handlePrintKey = (event: KeyboardEvent) => {
    const key = typeof event.key === "string" ? event.key.toLowerCase() : null;
    if (!key || key !== "p") {
      return;
    }

    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    event.preventDefault();
    triggerPrintInternal("keydown");
  };

  const handleBeforePrint = () => applyPrintSizing("beforeprint");
  const handleAfterPrint = () => resetSizing("afterprint");

  const isPrintMessage = (data: unknown): data is { action: "lydia:print"; reason?: string } => {
    if (!data || typeof data !== "object") {
      return false;
    }
    return (data as { action?: string }).action === "lydia:print";
  };

  const handleParentMessage = (event: MessageEvent) => {
    if (event.source !== window.parent) {
      return;
    }

    const data = event.data;
    if (!isPrintMessage(data)) {
      return;
    }

    const reason = data.reason;
    triggerPrintInternal(reason ? `parent:${reason}` : "parent");
  };

  const addCleanup = (cleanup: CleanupFn) => {
    cleanupFns.push(cleanup);
  };

  const addListener = (
    target: Window | Document,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) => {
    target.addEventListener(type, handler, options);
    addCleanup(() => target.removeEventListener(type, handler, options));
  };

  addListener(window, "keydown", handlePrintKey as EventListener, { passive: false });
  addListener(window, "beforeprint", handleBeforePrint as EventListener);
  addListener(window, "afterprint", handleAfterPrint as EventListener);
  addListener(window, "message", handleParentMessage as EventListener);

  const handleDocumentVisibilityChange = () => {
    if (document.visibilityState === "visible" && !isPreparingForPrint) {
      resetSizing("visibilitychange");
    }
  };
  addListener(document, "visibilitychange", handleDocumentVisibilityChange as EventListener);

  if (typeof ResizeObserver !== "undefined" && document.body) {
    resizeObserver = new ResizeObserver(() => {
      if (isPreparingForPrint) {
        const fullHeight = computeFullHeight();
        enforceSizing(fullHeight);
        return;
      }
    });

    resizeObserver.observe(document.body);
    addCleanup(() => {
      resizeObserver?.disconnect();
      resizeObserver = null;
    });
  }

  const triggerPrint = (reason?: string) =>
    triggerPrintInternal(reason ?? "external");

  const setupInitialHeightReporting = () => {
    const container = document.getElementById(outputElementId);

    if (
      container &&
      container.children.length > 0 &&
      !container.classList.contains("loading-message")
    ) {
      reportContentHeight("initial");
      return;
    }

    if (container && typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver((mutations) => {
        const hasNewNodes = mutations.some(
          (mutation) =>
            mutation.type === "childList" && mutation.addedNodes.length > 0
        );

        if (!hasNewNodes) {
          return;
        }

        observer.disconnect();
        reportContentHeight("mutation");
      });

      observer.observe(container, { childList: true, subtree: true });
      addCleanup(() => observer.disconnect());
      return;
    }

    if (!container) {
      const onLoad = () => reportContentHeight("load");
      if (document.readyState === "complete") {
        requestAnimationFrame(onLoad);
      } else {
        addListener(window, "load", onLoad as EventListener, { once: true });
      }
    }
  };

  setupInitialHeightReporting();

  const destroy = () => {
    cleanupFns.forEach((fn) => fn());
    cleanupFns.length = 0;
    resetSizing("destroy");
  };

  return {
    reportContentHeight,
    triggerPrint,
    destroy,
  };
}
