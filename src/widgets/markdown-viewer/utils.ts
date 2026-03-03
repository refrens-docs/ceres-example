/* eslint-disable @typescript-eslint/no-unused-vars, consistent-return */
/* ============================
 * Types (sealed contracts)
 * ============================ */

export type MarkdownMode =
  | "viewer" // Toast UI Viewer
  | "fallback" // marked fallback
  | "storage"; // DB write (strongest)

export type LinkSanitizationPolicy = "internal" | "external-forced";

/** Minimal interface for DOMPurify accessed via window global */
interface DOMPurifyInstance {
  sanitize(dirty: string, config?: Record<string, unknown>): string;
}

/* ============================
 * Constants (immutable)
 * ============================ */

export const defaultCustomLinkProps = Object.freeze({
  target: "_blank",
  rel: "noreferrer nofollow noopener external",
});

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ["br", "a"],
  ALLOWED_ATTR: ["href", "title"],
  KEEP_CONTENT: true,
} as const;

const DOMPURIFY_STORAGE_CONFIG = {
  ALLOWED_TAGS: [] as string[],
  ALLOWED_ATTR: [] as string[],
  KEEP_CONTENT: true,
} as const;

/* ============================
 * Internal helpers (sealed)
 * ============================ */

/**
 * Retrieve DOMPurify from the window global (loaded via script tag).
 */
function getDOMPurify(): DOMPurifyInstance | undefined {
  return (window as unknown as Record<string, unknown>).DOMPurify as
    | DOMPurifyInstance
    | undefined;
}

/**
 *
 * @param _
 */
function assertNever(_: never): never {
  throw new Error("Unreachable code path reached");
}

/* ============================
 * Public API
 * ============================ */

/**
 * URL sanitization with sealed policy
 * - Uses DOMPurify for URL validation
 * - Blocks javascript:, data:, blob:
 * @param rawUrl
 * @param policy
 */
export function sanitizeAnchorUrl(
  rawUrl: string,
  policy: LinkSanitizationPolicy
): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  try {
    const trimmed = rawUrl.trim();

    // Allow internal relative URLs explicitly
    if (trimmed.startsWith("/")) {
      return policy === "external-forced" ? "" : trimmed;
    }

    const DOMPurify = getDOMPurify();
    if (!DOMPurify) return trimmed;

    // Use DOMPurify's sanitizeUrl for validation
    const sanitized =
      DOMPurify.sanitize(`<a href="${trimmed}"></a>`, {
        ALLOWED_TAGS: ["a"],
        ALLOWED_ATTR: ["href"],
        RETURN_TRUSTED_TYPE: false,
      }).match(/href="([^"]*)"/)?.[1] || "";

    if (!sanitized) return "";

    if (policy === "external-forced" && !trimmed.startsWith("http")) {
      return "";
    }

    return sanitized;
  } catch {
    return "";
  }
}

/**
 * Markdown sanitization
 * - Uses DOMPurify for HTML sanitization
 * - Mode sealed
 * @param value
 * @param mode
 */
export function sanitizeMarkdown(value: string, mode: MarkdownMode): string {
  if (!value) return "";

  const DOMPurify = getDOMPurify();
  if (!DOMPurify) return value;

  switch (mode) {
    case "viewer":
      // Allow <br> and <a> tags for Toast UI, sanitize hrefs
      return DOMPurify.sanitize(value, {
        ...DOMPURIFY_CONFIG,
        ALLOW_DATA_ATTR: false,
      });

    case "fallback":
      return DOMPurify.sanitize(value, {
        ...DOMPURIFY_CONFIG,
        ALLOW_DATA_ATTR: false,
      });

    case "storage":
      // Strongest: zero HTML allowance
      return DOMPurify.sanitize(value, DOMPURIFY_STORAGE_CONFIG);

    default:
      assertNever(mode);
  }
}

/**
 * Fallback markdown preparation
 * - Pure transformation
 * - Uses DOMPurify for safety
 * @param value
 */
export function prepareFallbackMarkdown(value: string): string {
  if (!value) return "";

  const DOMPurify = getDOMPurify();
  const sanitized = DOMPurify
    ? DOMPurify.sanitize(value, DOMPURIFY_CONFIG)
    : value;

  return sanitized.replace(/<br\s*\/?>/gi, "\n").replace(/\n/g, "\n\n");
}

/* eslint-enable @typescript-eslint/no-unused-vars, consistent-return */
