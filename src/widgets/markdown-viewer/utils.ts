/* ============================
 * Types (sealed contracts)
 * ============================ */

export type MarkdownMode =
  | "viewer" // Toast UI Viewer
  | "fallback" // marked fallback
  | "storage"; // DB write (strongest)

export type LinkSanitizationPolicy = "internal" | "external-forced";

type SafeString = string & { readonly __safeBrand: unique symbol };

/* ============================
 * Constants (immutable)
 * ============================ */

const SAFE_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"] as const;

export const defaultCustomLinkProps = Object.freeze({
  target: "_blank",
  rel: "noreferrer nofollow noopener external",
});

/* ============================
 * Internal helpers (sealed)
 * ============================ */

function escapeHtmlUnsafe(input: string): SafeString {
  const escaped = input.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });

  return escaped as SafeString;
}

function assertNever(_: never): never {
  throw new Error("Unreachable code path reached");
}

/* ============================
 * Public API
 * ============================ */

/**
 * URL sanitization with sealed policy
 * - Blocks javascript:, data:, blob:
 * - Forces protocol normalization
 */
export function sanitizeAnchorUrl(
  rawUrl: string,
  policy: LinkSanitizationPolicy,
): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  try {
    const trimmed = rawUrl.trim();

    // Allow internal relative URLs explicitly
    if (trimmed.startsWith("/")) {
      return policy === "external-forced" ? "" : trimmed;
    }

    const parsed = new URL(
      trimmed,
      trimmed.startsWith("http") ? undefined : "https://example.com",
    );

    if (!SAFE_PROTOCOLS.includes(parsed.protocol as any)) {
      return "";
    }

    if (policy === "external-forced") {
      parsed.protocol = "https:";
    }

    return parsed.href;
  } catch {
    return "";
  }
}

/**
 * Markdown sanitization
 * - No bypass
 * - No unescape
 * - Mode sealed
 */
export function sanitizeMarkdown(value: string, mode: MarkdownMode): string {
  if (!value) return "";

  const escaped = escapeHtmlUnsafe(value);

  switch (mode) {
    case "viewer":
      // Toast UI supports <br> only
      return escaped.replace(/&lt;br\s*\/?&gt;/gi, "<br>");

    case "fallback":
      return escaped;

    case "storage":
      // Strongest: zero HTML allowance
      return escaped;

    default:
      assertNever(mode);
  }
}

/**
 * Fallback markdown preparation
 * - Pure transformation
 * - No HTML resurrection
 */
export function prepareFallbackMarkdown(value: string): string {
  if (!value) return "";

  return value.replace(/<br\s*\/?>/gi, "\n").replace(/\n/g, "\n\n");
}
