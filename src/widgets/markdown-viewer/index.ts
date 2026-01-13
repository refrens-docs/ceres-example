// @ts-ignore
import template from "./MarkdownViewer.hbs";

import {
  sanitizeMarkdown,
  prepareFallbackMarkdown,
  defaultCustomLinkProps,
  sanitizeAnchorUrl,
} from "./utils";

/* =========================================================
 * Types (sealed)
 * ========================================================= */

type MarkdownViewerPayload = {
  sanitizedMarkdown: string;
  fallbackMarkdown: string;
  customLinkProps: typeof defaultCustomLinkProps;
  forceFallbackRenderer: boolean;
};

/* =========================================================
 * Payload encoding (HTML + JSON safe)
 * ========================================================= */

function encodePayload(payload: MarkdownViewerPayload): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function decodePayload(encoded: string): MarkdownViewerPayload {
  return JSON.parse(decodeURIComponent(escape(atob(encoded))));
}

/* =========================================================
 * Handlebars access
 * ========================================================= */

function getHB(): any {
  return (window as any).Handlebars;
}

/* =========================================================
 * CDN dependencies
 * ========================================================= */

const DOMPURIFY_JS =
  "https://cdn.jsdelivr.net/npm/dompurify/dist/purify.min.js";
const TOAST_UI_CSS =
  "https://uicdn.toast.com/editor/latest/toastui-editor-viewer.min.css";
const TOAST_UI_JS =
  "https://uicdn.toast.com/editor/latest/toastui-editor-viewer.min.js";
const MARKED_JS = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";

let dependenciesPromise: Promise<void> | null = null;

function loadScript(src: string, globalName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any)[globalName]) {
      resolve();
      return;
    }

    const selector = `script[src="${src}"]`;
    let script = document.querySelector(selector) as HTMLScriptElement;

    if (!script) {
      script = document.createElement("script");
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () =>
      reject(new Error(`Failed to load ${src}`)),
    );
  });
}

function loadDependencies(): Promise<void> {
  if (dependenciesPromise) return dependenciesPromise;

  if (!document.querySelector(`link[href="${TOAST_UI_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = TOAST_UI_CSS;
    document.head.appendChild(link);
  }

  dependenciesPromise = Promise.all([
    loadScript(DOMPURIFY_JS, "DOMPurify"),
    loadScript(TOAST_UI_JS, "toastui"),
  ]).then(() => undefined);

  return dependenciesPromise;
}

function loadFallbackDependency(): Promise<void> {
  return Promise.all([
    loadScript(DOMPURIFY_JS, "DOMPurify"),
    loadScript(MARKED_JS, "marked"),
  ]).then(() => undefined);
}

/* =========================================================
 * Fallback renderer (marked)
 * ========================================================= */

function renderFallback(
  container: HTMLElement,
  markdown: string,
  customLinkProps: typeof defaultCustomLinkProps,
): void {
  const marked = (window as any).marked;

  if (!marked) {
    container.innerText = markdown;
    container.style.whiteSpace = "pre-wrap";
    return;
  }

  const renderer = new marked.Renderer();

  renderer.link = (href: string, title: string, text: string) => {
    const sanitized = sanitizeAnchorUrl(href, "external-forced");
    const titleAttr = title ? ` title="${title}"` : "";

    return (
      `<a href="${sanitized}" ` +
      `target="${customLinkProps.target}" ` +
      `rel="${customLinkProps.rel}"${titleAttr}>` +
      `${text}</a>`
    );
  };

  try {
    container.innerHTML = marked.parse(markdown, { renderer });
  } catch {
    container.innerText = markdown;
  }
}

/* =========================================================
 * Viewer initialization
 * ========================================================= */

function initViewer(
  container: HTMLElement,
  payload: MarkdownViewerPayload,
): void {
  // If fully initialized, skip
  if (container.dataset.mvInitialized === "true") return;

  const toastui = (window as any).toastui;
  const forceFallback = payload.forceFallbackRenderer;
  const canUpgrade = !forceFallback && toastui && toastui.Editor;

  if (!canUpgrade) {
    // If forced fallback, ensure marked is loaded
    if (forceFallback && !(window as any).marked) {
      loadFallbackDependency().then(() => {
        renderFallback(
          container,
          payload.fallbackMarkdown,
          payload.customLinkProps,
        );
      });
    }

    // Only render fallback if not yet initialized at all
    if (!container.dataset.mvInitialized) {
      renderFallback(
        container,
        payload.fallbackMarkdown,
        payload.customLinkProps,
      );
      // Mark as potential for upgrade unless forced
      container.dataset.mvInitialized = forceFallback ? "true" : "fallback";
    }
    return;
  }

  try {
    const Viewer = toastui.Editor;

    new Viewer({
      el: container,
      initialValue: payload.sanitizedMarkdown,
      usageStatistics: false,
      customHTMLRenderer: {
        link(node: any, context: any) {
          const result = context.origin();
          if (context.entering && result?.attributes) {
            result.attributes.href = sanitizeAnchorUrl(
              result.attributes.href,
              "external-forced",
            );
            Object.assign(result.attributes, payload.customLinkProps);
          }
          return result;
        },
      },
    });

    container.dataset.mvInitialized = "true";
  } catch (err) {
    console.error("MarkdownViewer init failed", err);
    // On error, stay in fallback state final
    renderFallback(
      container,
      payload.fallbackMarkdown,
      payload.customLinkProps,
    );
    container.dataset.mvInitialized = "true";
  }
}

/* =========================================================
 * Widget discovery + parsing
 * ========================================================= */

function processWidgets(): void {
  const widgets = document.querySelectorAll(
    '.markdown-viewer-widget:not([data-mv-initialized="true"])',
  );

  widgets.forEach((widget) => {
    const script = widget.querySelector(
      "script[data-md-viewer]",
    ) as HTMLScriptElement | null;

    if (!script) return;

    const encoded = script.getAttribute("data-payload");
    if (!encoded) return;

    let payload: MarkdownViewerPayload;

    try {
      payload = decodePayload(encoded);
    } catch (err) {
      widget.setAttribute("data-mv-initialized", "error");
      console.error("Failed to parse MarkdownViewer payload", err);
      return;
    }

    initViewer(widget as HTMLElement, payload);
  });
}

/* =========================================================
 * Observation + lifecycle
 * ========================================================= */

function startObserver(): void {
  // Trigger load but handle async
  loadDependencies()
    .then(() => processWidgets())
    .catch((err) => {
      console.warn("ToastUI failed loading, falling back to marked", err);
      // If ToastUI fails, load marked for fallback rendering
      return loadFallbackDependency().then(() => processWidgets());
    });

  // Immediate pass (likely fallback)
  processWidgets();

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((m) => m.addedNodes.length > 0)) {
      processWidgets();
    }
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  } else {
    window.addEventListener("load", () => {
      processWidgets();
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  }
}

/* =========================================================
 * Handlebars registration
 * ========================================================= */

function register(): void {
  const HB = getHB();
  if (!HB) return;

  HB.registerHelper(
    "prepareMarkdownViewerData",
    function (content: string, options: any) {
      const safeContent = content || "";

      const payload: MarkdownViewerPayload = {
        sanitizedMarkdown: sanitizeMarkdown(safeContent, "viewer"),
        fallbackMarkdown: prepareFallbackMarkdown(safeContent),
        customLinkProps: defaultCustomLinkProps,
        forceFallbackRenderer: options?.hash?.forceFallback === true,
      };

      return {
        elementId:
          "md-viewer-" + Math.random().toString(36).slice(2) + "-" + Date.now(),
        payloadBase64: encodePayload(payload),
      };
    },
  );

  HB.registerPartial("MarkdownViewer", template);

  (window as any).CeresWidgets = (window as any).CeresWidgets || {};
  (window as any).CeresWidgets.MarkdownViewer = { register };

  startObserver();
}

/* =========================================================
 * Boot
 * ========================================================= */

try {
  register();
} catch (error) {
  console.error("MarkdownViewer registration failed:", error);
}

export {};
