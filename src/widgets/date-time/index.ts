/* eslint-disable @typescript-eslint/no-unused-vars, default-param-last */
// Small, dependency-free date helpers for Ceres templates
// Registers Handlebars helpers: formatDate, formatDateWithOffset, formateShortDateWithOffset,
// formatHalfDate, formatHalfDateWithOffset, formatDateTime, formatShortDateTime,
// formatFullDate, formatFullDateWithOffset, formatTimeSince, relativeTime, formateDateWithOffset

/**
 *
 */
function getHB(): any {
  return (window as any).Handlebars;
}

const HALF_DATE_FORMAT = "MMM DD";
const SHORT_DATE_FORMAT = "MMM DD, YYYY";
const PRIMARY_DATE_FORMAT = "MMMM DD, YYYY";
const SECONDARY_SHORT_DATE_FORMAT = "MMM dd, yyyy";

type FormatStyle = "half" | "short" | "primary" | "secondary" | "month";

/**
 *
 * @param input
 */
export function safeDate(input: any): Date | null {
  if (!input && input !== 0) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 *
 * @param offset
 */
export function parseOffset(offset: string | number | undefined): number {
  if (!offset && offset !== 0) return 0;
  if (typeof offset === "number") return offset;
  // expect +HH:mm or -HH:mm
  const m = String(offset).match(/^([+-]?)(\d{1,2}):?(\d{2})?$/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hours = parseInt(m[2], 10) || 0;
  const minutes = parseInt(m[3] || "0", 10) || 0;
  return sign * (hours * 60 + minutes);
}

/**
 *
 * @param d
 * @param offsetStr
 */
function withOffset(d: Date, offsetStr?: string | number): Date {
  const targetMinutes = parseOffset(offsetStr);
  // current local offset in minutes
  const localOffset = -d.getTimezoneOffset(); // getTimezoneOffset is minutes behind UTC, but negative sign
  // compute delta to apply to time (target - local)
  const delta = (targetMinutes - localOffset) * 60000;
  return new Date(d.getTime() + delta);
}

/**
 *
 * @param value
 */
function looksLikeOffset(value: any): value is string | number {
  if (typeof value === "number") return true;
  if (typeof value !== "string") return false;
  return /^([+-]?)(\d{1,2}):?(\d{2})?$/.test(value);
}

/**
 *
 * @param d
 * @param opts
 * @param locale
 * @param timeZone
 */
function fmtDate(
  d: Date,
  opts: Intl.DateTimeFormatOptions,
  locale = "en-US",
  timeZone?: string
) {
  try {
    const options = timeZone ? { ...opts, timeZone } : opts;
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch (e) {
    return d.toLocaleString();
  }
}

/**
 *
 * @param d
 * @param style
 * @param locale
 * @param timeZone
 */
export function formatByStyle(
  d: Date,
  style: FormatStyle,
  locale = "en-US",
  timeZone?: string
) {
  switch (style) {
    case "half":
      return fmtDate(d, { month: "short", day: "2-digit" }, locale, timeZone);
    case "short":
      return fmtDate(
        d,
        { month: "short", day: "2-digit", year: "numeric" },
        locale,
        timeZone
      );
    case "primary":
      return fmtDate(
        d,
        { month: "long", day: "2-digit", year: "numeric" },
        locale,
        timeZone
      );
    case "secondary":
      // Secondary matches short in formatting but may differ via locale tokens
      return fmtDate(
        d,
        { month: "short", day: "2-digit", year: "numeric" },
        locale,
        timeZone
      );
    case "month":
      return fmtDate(d, { month: "long", year: "numeric" }, locale, timeZone);
    default:
      return fmtDate(
        d,
        { month: "short", day: "2-digit", year: "numeric" },
        locale,
        timeZone
      );
  }
}

/**
 *
 * @param key
 */
function mapFormatKey(key?: string): FormatStyle {
  if (!key) return "secondary";
  const normalized = String(key).toUpperCase();
  switch (normalized) {
    case "HALF":
    case "HALF_DATE_FORMAT":
      return "half";
    case "SHORT":
    case "SHORT_DATE_FORMAT":
      return "short";
    case "PRIMARY":
    case "PRIMARY_DATE_FORMAT":
      return "primary";
    case "MONTH":
      return "month";
    case "SECONDARY":
    case "SECONDARY_SHORT_DATE_FORMAT":
    default:
      return "secondary";
  }
}

/**
 *
 * @param date
 */
function formatHalfDate(date: any) {
  const d = safeDate(date);
  if (!d) return "";
  return formatByStyle(d, "half");
}

/**
 *
 * @param date
 * @param offset
 */
function formatHalfDateWithOffset(date: any, offset = "+5:30") {
  const d = safeDate(date);
  if (!d) return "";
  return formatByStyle(withOffset(d, offset), "half");
}

/**
 *
 * @param date
 */
function formatDate(date: any) {
  const d = safeDate(date);
  if (!d) return "";
  return formatByStyle(d, "short");
}

/**
 *
 * @param date
 * @param offset
 */
function formatDateWithOffset(date: any, offset = "+5:30") {
  const d = safeDate(date);
  if (!d) return "";
  return formatByStyle(withOffset(d, offset), "primary");
}

/**
 *
 * @param date
 * @param offset
 */
function formateShortDateWithOffset(date: any, offset = "+5:30") {
  const d = safeDate(date);
  if (!d) return "";
  return formatByStyle(withOffset(d, offset), "short");
}

/**
 *
 * @param date
 */
function formatDateTime(date: any) {
  const d = safeDate(date);
  if (!d) return "";
  const datePart = formatByStyle(d, "short");
  const timePart = fmtDate(d, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} | ${timePart}`;
}

/**
 *
 * @param date
 */
function formatShortDateTime(date: any) {
  const d = safeDate(date);
  if (!d) return "";
  const datePart = formatByStyle(d, "half");
  const timePart = fmtDate(d, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

/**
 *
 * @param date
 * @param format
 */
function formatFullDate(date: any, format = undefined) {
  const d = safeDate(date);
  if (!d) return "";
  return formatByStyle(d, "short");
}

/**
 *
 * @param date
 * @param offset
 * @param format
 */
function formatFullDateWithOffset(
  date: any,
  offset = "+5:30",
  format = undefined
) {
  const d = safeDate(date);
  if (!d) return "";
  return formatByStyle(withOffset(d, offset), "short");
}

/**
 *
 * @param date
 * @param offset
 */
function formateDateWithOffset(date: any, offset = "+5:30") {
  return formateShortDateWithOffset(date, offset);
}

/**
 *
 * @param date
 * @param timeZone
 * @param formatKey
 */
function formatDateInTimeZone(date: any, timeZone = "UTC", formatKey?: string) {
  const d = safeDate(date);
  if (!d) return "";
  const style = mapFormatKey(formatKey);
  return formatByStyle(d, style, "en-US", timeZone);
}

/**
 *
 * @param date
 * @param days
 */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

/**
 *
 * @param date
 * @param days
 * @param offset
 */
function formatDateAddDays(date: any, days: any, offset?: string | number) {
  const d = safeDate(date);
  if (!d) return "";
  const dayCount = Number(days);
  if (Number.isNaN(dayCount)) return "";

  const adjusted = addDays(d, dayCount);
  const targetDate = looksLikeOffset(offset)
    ? withOffset(adjusted, offset)
    : adjusted;
  return formatByStyle(targetDate, "short", "en-US");
}

/**
 *
 * @param date
 * @param days
 */
function addDaysISO(date: any, days: any) {
  const d = safeDate(date);
  if (!d) return "";
  const dayCount = Number(days);
  if (Number.isNaN(dayCount)) return "";
  return addDays(d, dayCount).toISOString();
}

/**
 *
 * @param a
 * @param b
 */
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 *
 * @param date
 */
function formatTimeSince(date: any) {
  const d = safeDate(date);
  if (!d) return "";
  const now = new Date();
  if (isSameDay(now, d)) {
    const timePart = fmtDate(d, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `Today, ${timePart}`;
  }
  if (now.getFullYear() === d.getFullYear()) {
    return formatHalfDate(d);
  }
  return formatDate(d);
}

/**
 *
 * @param date
 */
function relativeTime(date: any) {
  const d = safeDate(date);
  if (!d) return "";
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffSeconds = Math.round(Math.abs(diffMs) / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);

  const suffix = diffMs < 0 ? " ago" : "";
  const prefix = diffMs > 0 ? "in " : "";

  let result = "";
  if (diffSeconds < 30) {
    result = "less than a minute";
  } else if (diffSeconds < 90) {
    result = "1 minute";
  } else if (diffMinutes < 45) {
    result = `${diffMinutes} minutes`;
  } else if (diffMinutes < 90) {
    result = "about 1 hour";
  } else if (diffMinutes < 22 * 60) {
    const hours = Math.round(diffMinutes / 60);
    result = `about ${hours} hours`;
  } else if (diffMinutes < 36 * 60) {
    result = "1 day";
  } else if (diffMinutes < 25 * 1440) {
    const days = Math.round(diffMinutes / 1440);
    result = `${days} days`;
  } else if (diffMinutes < 45 * 1440) {
    result = "about 1 month";
  } else if (diffMinutes < 320 * 1440) {
    const months = Math.round(diffMinutes / 43200);
    result = `${months} months`;
  } else if (diffMinutes < 548 * 1440) {
    result = "about 1 year";
  } else if (diffMinutes < 730 * 1440) {
    result = "over 1 year";
  } else {
    const years = Math.round(diffMinutes / 525600);
    result = `almost ${years} years`;
  }

  return `${prefix}${result}${suffix}`.trim();
}

/**
 *
 */
function register() {
  const HB = getHB();
  if (!HB) return;

  HB.registerHelper("formatDate", function (date: any) {
    return formatDate(date);
  });
  HB.registerHelper("formatDateWithOffset", function (date: any, offset: any) {
    return formatDateWithOffset(date, offset);
  });
  HB.registerHelper(
    "formateShortDateWithOffset",
    function (date: any, offset: any) {
      return formateShortDateWithOffset(date, offset);
    }
  );
  HB.registerHelper("formatHalfDate", function (date: any) {
    return formatHalfDate(date);
  });
  HB.registerHelper(
    "formatHalfDateWithOffset",
    function (date: any, offset: any) {
      return formatHalfDateWithOffset(date, offset);
    }
  );
  HB.registerHelper("formatDateTime", function (date: any) {
    return formatDateTime(date);
  });
  HB.registerHelper("formatShortDateTime", function (date: any) {
    return formatShortDateTime(date);
  });
  HB.registerHelper("formatFullDate", function (date: any) {
    return formatFullDate(date);
  });
  HB.registerHelper(
    "formatFullDateWithOffset",
    function (date: any, offset: any) {
      return formatFullDateWithOffset(date, offset);
    }
  );
  HB.registerHelper("formatTimeSince", function (date: any) {
    return formatTimeSince(date);
  });
  HB.registerHelper("relativeTime", function (date: any) {
    return relativeTime(date);
  });
  HB.registerHelper("formateDateWithOffset", function (date: any, offset: any) {
    return formateDateWithOffset(date, offset);
  });
  HB.registerHelper(
    "formatDateInTimeZone",
    function (date: any, timeZone: any, formatKey: any) {
      return formatDateInTimeZone(date, timeZone, formatKey);
    }
  );
  HB.registerHelper(
    "formatDateAddDays",
    function (date: any, days: any, offset: any) {
      return formatDateAddDays(date, days, offset);
    }
  );
  HB.registerHelper("addDays", function (date: any, days: any) {
    return addDaysISO(date, days);
  });

  (window as any).CeresWidgets = (window as any).CeresWidgets || {};
  (window as any).CeresWidgets.DateTime = {
    register,
    helpers: {
      HALF_DATE_FORMAT,
      SHORT_DATE_FORMAT,
      PRIMARY_DATE_FORMAT,
      SECONDARY_SHORT_DATE_FORMAT,
      formatDateInTimeZone,
      formatDateAddDays,
    },
  };
}

try {
  register();
} catch (_) {
  /* noop */
}

export { };

/* eslint-enable @typescript-eslint/no-unused-vars, default-param-last */
