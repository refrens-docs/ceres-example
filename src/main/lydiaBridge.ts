/**
 * Lydia Bridge — the communication layer between Ceres and Lydia.
 *
 * When a business uses a custom layout template for their documents (invoices, quotations, etc.),
 * Lydia doesn't render the document itself. Instead, it embeds Ceres inside an <iframe>.
 * Ceres fetches the document data from Serana, renders it using the custom template, and then
 * needs to tell Lydia how tall the content is so the iframe fits naturally — no scrollbars,
 * no clipping. That's what this bridge handles.
 *
 * The lifecycle looks like this:
 *   1. Lydia builds a Ceres URL with ?template=...&apiUrl=... and drops it into an iframe
 *   2. Ceres renders the document template into #documentOutput
 *   3. This bridge wakes up (if ?isLydiaMode is present), measures the content height,
 *      and posts it to Lydia via postMessage
 *   4. Lydia's useIframeHeight hook picks up the message and resizes the iframe
 *   5. When the user prints, this bridge takes over sizing so the PDF comes out clean
 *
 * The bridge only activates when loaded inside Lydia's iframe — it's a no-op otherwise.
 * Pass ?debugHeight in the URL to see what's happening in the console.
 */

const LYDIA_MODE_PARAM = 'isLydiaMode';
const DEBUG_PARAM = 'debugHeight';
const HEIGHT_MESSAGE_TYPE = 'ceres:content-height';
const HEIGHT_MESSAGE_SOURCE = 'ceres';
const PRINT_HEIGHT_BUFFER = 80;
const PARENT_HEIGHT_BUFFER = 64;

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
 * Boots the bridge. Called by Ceres' main renderer after the template is injected.
 * Returns null if we're not inside Lydia's iframe — so it's always safe to call.
 */
export function initLydiaBridge(options?: LydiaBridgeOptions): LydiaBridgeHandle | null {
  // Not in a browser — nothing to bridge
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const lydiaModeEnabled = searchParams.get(LYDIA_MODE_PARAM);

  // Not embedded inside Lydia — stand down
  if (!lydiaModeEnabled) {
    return null;
  }

  const shouldDebug = searchParams.has(DEBUG_PARAM);
  const outputElementId = options?.outputElementId ?? 'documentOutput';

  let isPreparingForPrint = false;
  let hasSentInitialHeight = false;
  let lastComputedHeight: number | null = null;
  let lastReportedHeight: number | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const cleanupFns: CleanupFn[] = [];

  const debugLog = (...args: unknown[]) => {
    if (shouldDebug) {
      console.debug('[CeresPrint]', ...args);
    }
  };

  // Measures the full document height using every reliable method available.
  // Different browsers report height differently, so we take the max of all approaches.
  const computeFullHeight = (): number => {
    const { body, documentElement: docEl } = document;
    if (!body || !docEl) {
      return 0;
    }

    return Math.max(
      body.scrollHeight,
      docEl.scrollHeight,
      body.offsetHeight,
      docEl.offsetHeight,
      body.getBoundingClientRect().height,
      docEl.getBoundingClientRect().height,
    );
  };

  // Sends the measured height to Lydia so it can resize the iframe to fit.
  // Skips duplicate reports on resize to avoid unnecessary chatter.
  const postHeightToParent = (fullHeight: number, reason = 'resize') => {
    if (window.parent == null || window.parent === window) {
      return;
    }

    if (typeof window.parent.postMessage !== 'function') {
      return;
    }

    if (!Number.isFinite(fullHeight)) {
      return;
    }

    const height = Math.ceil(fullHeight + PARENT_HEIGHT_BUFFER);

    if (lastReportedHeight === height && reason === 'resize') {
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

    window.parent.postMessage(payload, '*');
    debugLog('postHeightToParent', payload);
  };

  // The first height report is special — it's the moment Lydia knows the content is ready.
  // We only send it once; after that, resize events take over.
  const reportInitialHeight = (fullHeight: number, reason = 'init') => {
    if (!Number.isFinite(fullHeight) || fullHeight <= 0) {
      return;
    }

    lastComputedHeight = fullHeight;

    if (hasSentInitialHeight) {
      return;
    }

    hasSentInitialHeight = true;
    postHeightToParent(fullHeight, reason);
    debugLog('reportInitialHeight', { reason, fullHeight });
  };

  // Locks the document to a minimum height so the browser doesn't collapse it during print.
  // The extra buffer accounts for browser chrome and margin quirks in print mode.
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

  // Prepares the document for printing. Browsers behave oddly with iframed content —
  // they can clip, collapse, or misalign things. We force everything to auto/visible
  // and then pin the height so the full document makes it to the PDF.
  const applyPrintSizing = (reason = 'manual') => {
    const docEl = document.documentElement;
    const body = document.body;

    if (!docEl || !body) {
      return;
    }

    isPreparingForPrint = true;

    docEl.style.height = 'auto';
    body.style.height = 'auto';
    docEl.style.overflow = 'visible';
    body.style.overflow = 'visible';
    docEl.style.width = 'auto';
    body.style.width = 'auto';
    body.style.display = 'block';
    body.style.alignItems = 'stretch';

    const fullHeight = computeFullHeight();
    enforceSizing(fullHeight);

    debugLog('applyPrintSizing', { reason, fullHeight });
  };

  // Undoes the print overrides so the document goes back to normal after printing.
  const resetSizing = (reason = 'manual') => {
    const docEl = document.documentElement;
    const body = document.body;

    if (!docEl || !body) {
      return;
    }

    isPreparingForPrint = false;

    docEl.style.removeProperty('min-height');
    body.style.removeProperty('min-height');
    docEl.style.removeProperty('height');
    body.style.removeProperty('height');
    docEl.style.removeProperty('overflow');
    body.style.removeProperty('overflow');
    docEl.style.removeProperty('width');
    body.style.removeProperty('width');
    body.style.removeProperty('display');
    body.style.removeProperty('align-items');

    debugLog('resetSizing', { reason });
  };

  // The actual print trigger. We apply sizing first, then wait two animation frames
  // to let the browser settle before calling window.print(). One frame isn't enough —
  // the browser needs a full paint cycle to reflect the style changes.
  const triggerIframePrintInternal = (reason = 'manual') => {
    applyPrintSizing(reason);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        debugLog('triggerIframePrint', { reason, height: lastComputedHeight });
        window.print();
      });
    });
  };

  // Called by Ceres' renderer after the template has been injected into the DOM.
  // Waits two frames for the browser to finish layout, then measures and reports.
  const reportContentHeight = (reason = 'render-complete') => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fullHeight = computeFullHeight();
        if (!hasSentInitialHeight) {
          reportInitialHeight(fullHeight, reason);
        } else {
          lastComputedHeight = fullHeight;
        }
      });
    });
  };

  // Intercepts Ctrl+P / Cmd+P inside the iframe so we can prep the layout before printing.
  // Without this, the browser would print the iframe content as-is, which can look broken.
  const handlePrintKey = (event: KeyboardEvent) => {
    const key = typeof event.key === 'string' ? event.key.toLowerCase() : null;
    if (!key || key !== 'p') {
      return;
    }

    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    event.preventDefault();
    triggerIframePrintInternal('keydown');
  };

  const handleBeforePrint = () => applyPrintSizing('beforeprint');
  const handleAfterPrint = () => resetSizing('afterprint');

  // Listens for print commands from Lydia. When the user hits print in the parent app,
  // Lydia sends { action: 'lydia:print' } so Ceres can prepare the layout first.
  const handleParentMessage = (event: MessageEvent) => {
    if (event.source !== window.parent) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    const action = (data as { action?: string }).action;
    if (action !== 'lydia:print') {
      return;
    }

    const reason = (data as { reason?: string }).reason;
    triggerIframePrintInternal(reason ? `parent:${reason}` : 'parent');
  };

  const addCleanup = (cleanup: CleanupFn) => {
    cleanupFns.push(cleanup);
  };

  const addWindowListener = <K extends keyof WindowEventMap>(
    type: K,
    handler: (event: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ) => {
    const listener = handler as EventListener;
    window.addEventListener(type, listener, options);
    addCleanup(() => window.removeEventListener(type, listener, options));
  };

  // Wire up all the event listeners. Everything gets tracked for cleanup on destroy.
  addWindowListener('keydown', handlePrintKey, { passive: false });
  addWindowListener('beforeprint', handleBeforePrint);
  addWindowListener('afterprint', handleAfterPrint);
  addWindowListener('message', handleParentMessage);

  // Some browsers leave print styles stuck when the user switches tabs during a print dialog.
  // When the tab comes back into view, we clean up just in case.
  const handleDocumentVisibilityChange = () => {
    if (document.visibilityState === 'visible' && !isPreparingForPrint) {
      resetSizing('visibilitychange');
    }
  };

  document.addEventListener('visibilitychange', handleDocumentVisibilityChange);
  addCleanup(() => document.removeEventListener('visibilitychange', handleDocumentVisibilityChange));

  // Watch for content size changes after initial render — images loading, fonts swapping,
  // or dynamic content shifting things around. During print prep, we re-enforce sizing;
  // otherwise we just track the latest height quietly.
  if (typeof ResizeObserver !== 'undefined' && document.body) {
    resizeObserver = new ResizeObserver(() => {
      const fullHeight = computeFullHeight();
      if (isPreparingForPrint) {
        enforceSizing(fullHeight);
      } else {
        lastComputedHeight = fullHeight;
      }
    });

    resizeObserver.observe(document.body);
    addCleanup(() => {
      resizeObserver?.disconnect();
      resizeObserver = null;
    });
  }

  const triggerPrint = (reason?: string) => triggerIframePrintInternal(reason ?? 'external');

  // Figure out when the template content is actually in the DOM so we can report
  // the first meaningful height to Lydia. Three strategies, in order of preference:
  //   1. Content is already there — measure immediately
  //   2. Container exists but is empty — watch for the first child nodes to appear
  //   3. No container at all — fall back to the window load event
  const container = document.getElementById(outputElementId);

  if (container && container.children.length > 0) {
    reportContentHeight('initial');
  } else if (container && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver((mutations) => {
      if (hasSentInitialHeight) {
        observer.disconnect();
        return;
      }

      const hasNewNodes = mutations.some(
        (mutation) => mutation.type === 'childList' && mutation.addedNodes.length > 0,
      );

      if (!hasNewNodes) {
        return;
      }

      observer.disconnect();
      reportContentHeight('mutation');
    });

    observer.observe(container, { childList: true, subtree: true });
    addCleanup(() => observer.disconnect());
  } else if (!container) {
    const onLoad = () => reportContentHeight('load');
    if (document.readyState === 'complete') {
      requestAnimationFrame(onLoad);
    } else {
      window.addEventListener('load', onLoad, { once: true });
      addCleanup(() => window.removeEventListener('load', onLoad));
    }
  }

  const destroy = () => {
    cleanupFns.forEach((fn) => fn());
    cleanupFns.length = 0;
    resetSizing('destroy');
  };

  return {
    reportContentHeight,
    triggerPrint,
    destroy,
  };
}
