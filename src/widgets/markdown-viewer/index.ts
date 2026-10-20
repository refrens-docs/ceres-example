/* eslint-disable @typescript-eslint/ban-ts-comment, no-new, consistent-return */
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
  /** The content as written: sanitized when it is drawn, once DOMPurify has loaded. */
  rawMarkdown?: string;
  customLinkProps: typeof defaultCustomLinkProps;
  forceFallbackRenderer: boolean;
};

/* =========================================================
 * Payload encoding (HTML + JSON safe)
 * ========================================================= */

/**
 *
 * @param payload
 */
function encodePayload(payload: MarkdownViewerPayload): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

/**
 *
 * @param encoded
 */
function decodePayload(encoded: string): MarkdownViewerPayload {
  return JSON.parse(decodeURIComponent(escape(atob(encoded))));
}

/* =========================================================
 * Handlebars access
 * ========================================================= */

/**
 *
 */
function getHB(): any {
  return (window as any).Handlebars;
}

/* =========================================================
 * Self-hosted vendor dependencies (loaded from vendor-manifest.json)
 * ========================================================= */

type VendorManifest = Record<string, { js?: string; css?: string }>;

let vendorManifestPromise: Promise<VendorManifest> | null = null;

/**
 * Fetch vendor-manifest.json once and cache the result.
 */
function loadVendorManifest(): Promise<VendorManifest> {
  if (vendorManifestPromise) return vendorManifestPromise;

  vendorManifestPromise = fetch("./vendor-manifest.json")
    .then((r) => {
      if (!r.ok) throw new Error(`vendor-manifest.json: ${r.status}`);
      return r.json() as Promise<VendorManifest>;
    })
    .catch((err) => {
      // Reset so a retry is possible
      vendorManifestPromise = null;
      throw err;
    });

  return vendorManifestPromise;
}

let dependenciesPromise: Promise<void> | null = null;

/** Set when Toast UI could not load, so notes already shown as plain text go to marked. */
let viewerUnavailable = false;

/*
 * Each widget's payload, read once. The plain-text first pass replaces the widget's content,
 * payload script included, so the upgrade to the formatted view must not depend on it: without
 * this a note drawn before Toast UI loaded stayed as raw text for good (**bold**, | --- |).
 */
const payloads = new WeakMap<Element, MarkdownViewerPayload>();

/**
 * The markdown to draw: sanitized now when DOMPurify is loaded, so the result no longer
 * depends on whether it had loaded when the template rendered.
 * @param payload
 */
function viewerMarkdown(payload: MarkdownViewerPayload): string {
  return typeof payload.rawMarkdown === "string" && (window as any).DOMPurify
    ? sanitizeMarkdown(payload.rawMarkdown, "viewer")
    : payload.sanitizedMarkdown;
}

/**
 * @param payload
 */
function fallbackMarkdown(payload: MarkdownViewerPayload): string {
  return typeof payload.rawMarkdown === "string" && (window as any).DOMPurify
    ? prepareFallbackMarkdown(payload.rawMarkdown)
    : payload.fallbackMarkdown;
}

/**
 *
 * @param src
 * @param globalName
 */
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
      reject(new Error(`Failed to load ${src}`))
    );
  });
}

/**
 * Load a CSS file if not already present.
 * @param href
 */
function loadCSS(href: string): void {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

/**
 *
 */
function loadDependencies(): Promise<void> {
  if (dependenciesPromise) return dependenciesPromise;

  dependenciesPromise = loadVendorManifest().then((manifest) => {
    const dp = manifest.dompurify;
    const tu = manifest["toastui-editor"];

    if (!dp?.js) throw new Error("Vendor manifest missing dompurify entry");
    if (!tu?.js)
      throw new Error("Vendor manifest missing toastui-editor entry");

    if (tu.css) loadCSS(`./${tu.css}`);

    return Promise.all([
      loadScript(`./${dp.js}`, "DOMPurify"),
      loadScript(`./${tu.js}`, "toastui"),
    ]).then(() => undefined);
  });

  return dependenciesPromise;
}

/**
 *
 */
function loadFallbackDependency(): Promise<void> {
  return loadVendorManifest().then((manifest) => {
    const dp = manifest.dompurify;
    const mk = manifest.marked;

    if (!dp?.js) throw new Error("Vendor manifest missing dompurify entry");
    if (!mk?.js) throw new Error("Vendor manifest missing marked entry");

    return Promise.all([
      loadScript(`./${dp.js}`, "DOMPurify"),
      loadScript(`./${mk.js}`, "marked"),
    ]).then(() => undefined);
  });
}

/* =========================================================
 * Fallback renderer (marked)
 * ========================================================= */

/**
 *
 * @param container
 * @param markdown
 * @param customLinkProps
 */
function renderFallback(
  container: HTMLElement,
  markdown: string,
  customLinkProps: typeof defaultCustomLinkProps
): void {
  const { marked } = window as any;

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
    container.innerHTML = marked(markdown, { renderer });
  } catch {
    container.innerText = markdown;
  }
}

/* =========================================================
 * Viewer initialization
 * ========================================================= */

/**
 *
 * @param container
 * @param payload
 */
function initViewer(
  container: HTMLElement,
  payload: MarkdownViewerPayload
): void {
  // If fully initialized, skip
  if (container.dataset.mvInitialized === "true") return;

  const { toastui } = window as any;
  const forceFallback = payload.forceFallbackRenderer;
  const canUpgrade = !forceFallback && toastui && toastui.Editor;

  if (!canUpgrade) {
    // If forced fallback, ensure marked is loaded
    if (forceFallback && !(window as any).marked) {
      loadFallbackDependency().then(() => {
        renderFallback(
          container,
          fallbackMarkdown(payload),
          payload.customLinkProps
        );
      });
    }

    // Toast UI is not coming: a note shown as plain text is drawn with marked now.
    if (
      container.dataset.mvInitialized === "fallback" &&
      viewerUnavailable &&
      (window as any).marked
    ) {
      renderFallback(
        container,
        fallbackMarkdown(payload),
        payload.customLinkProps
      );
      container.dataset.mvInitialized = "true";
      return;
    }

    // Only render fallback if not yet initialized at all
    if (!container.dataset.mvInitialized) {
      renderFallback(
        container,
        fallbackMarkdown(payload),
        payload.customLinkProps
      );
      // Mark as potential for upgrade unless forced
      container.dataset.mvInitialized = forceFallback ? "true" : "fallback";
    }
    return;
  }

  try {
    const Viewer = toastui.Editor;

    // Clear the plain-text first pass (or the payload script) before drawing.
    container.textContent = "";
    new Viewer({
      el: container,
      initialValue: viewerMarkdown(payload),
      usageStatistics: false,
      customHTMLRenderer: {
        link(node: any, context: any) {
          const result = context.origin();
          if (context.entering && result?.attributes) {
            result.attributes.href = sanitizeAnchorUrl(
              result.attributes.href,
              "external-forced"
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
      fallbackMarkdown(payload),
      payload.customLinkProps
    );
    container.dataset.mvInitialized = "true";
  }
}

/* =========================================================
 * Widget discovery + parsing
 * ========================================================= */

/**
 *
 */
function processWidgets(): void {
  const widgets = document.querySelectorAll(
    '.markdown-viewer-widget:not([data-mv-initialized="true"])'
  );

  widgets.forEach((widget) => {
    let payload = payloads.get(widget);

    if (!payload) {
      const script = widget.querySelector(
        "script[data-md-viewer]"
      ) as HTMLScriptElement | null;

      if (!script) return;

      const encoded = script.getAttribute("data-payload");
      if (!encoded) return;

      try {
        payload = decodePayload(encoded);
      } catch (err) {
        widget.setAttribute("data-mv-initialized", "error");
        console.error("Failed to parse MarkdownViewer payload", err);
        return;
      }
      payloads.set(widget, payload);
    }

    initViewer(widget as HTMLElement, payload);
  });
}

/* =========================================================
 * Observation + lifecycle
 * ========================================================= */

/**
 *
 */
function startObserver(): void {
  // Trigger load but handle async
  loadDependencies()
    .then(() => processWidgets())
    .catch((err) => {
      console.warn("ToastUI failed loading, falling back to marked", err);
      viewerUnavailable = true;
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

/**
 *
 */
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
        rawMarkdown: safeContent,
        customLinkProps: defaultCustomLinkProps,
        forceFallbackRenderer: options?.hash?.forceFallback === true,
      };

      return {
        elementId: `md-viewer-${Math.random()
          .toString(36)
          .slice(2)}-${Date.now()}`,
        payloadBase64: encodePayload(payload),
      };
    }
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

/* eslint-enable @typescript-eslint/ban-ts-comment, no-new, consistent-return */
