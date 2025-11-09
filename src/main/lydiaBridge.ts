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

export function initLydiaBridge(options?: LydiaBridgeOptions): LydiaBridgeHandle | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const lydiaModeEnabled = searchParams.get(LYDIA_MODE_PARAM);

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

  const triggerIframePrintInternal = (reason = 'manual') => {
    applyPrintSizing(reason);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        debugLog('triggerIframePrint', { reason, height: lastComputedHeight });
        window.print();
      });
    });
  };

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

  addWindowListener('keydown', handlePrintKey, { passive: false });
  addWindowListener('beforeprint', handleBeforePrint);
  addWindowListener('afterprint', handleAfterPrint);
  addWindowListener('message', handleParentMessage);

  const handleDocumentVisibilityChange = () => {
    if (document.visibilityState === 'visible' && !isPreparingForPrint) {
      resetSizing('visibilitychange');
    }
  };

  document.addEventListener('visibilitychange', handleDocumentVisibilityChange);
  addCleanup(() => document.removeEventListener('visibilitychange', handleDocumentVisibilityChange));

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
