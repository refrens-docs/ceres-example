// Small, dependency-free date helpers for Ceres templates
// Registers Handlebars helpers: formatDate, formatDateWithOffset, formateShortDateWithOffset,
// formatHalfDate, formatHalfDateWithOffset, formatDateTime, formatShortDateTime,
// formatFullDate, formatFullDateWithOffset, formatTimeSince, relativeTime, formateDateWithOffset

function getHB(): any { return (window as any).Handlebars; }

const HALF_DATE_FORMAT = 'MMM DD';
const SHORT_DATE_FORMAT = 'MMM DD, YYYY';
const PRIMARY_DATE_FORMAT = 'MMMM DD, YYYY';
const SECONDARY_SHORT_DATE_FORMAT = 'MMM dd, yyyy';

type FormatStyle = 'half' | 'short' | 'primary' | 'secondary' | 'month';

function safeDate(input: any): Date | null {
  if (!input && input !== 0) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseOffset(offset: string | number | undefined): number {
  if (!offset && offset !== 0) return 0;
  if (typeof offset === 'number') return offset;
  // expect +HH:mm or -HH:mm
  const m = String(offset).match(/^([+-]?)(\d{1,2}):?(\d{2})?$/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  const hours = parseInt(m[2], 10) || 0;
  const minutes = parseInt(m[3] || '0', 10) || 0;
  return sign * (hours * 60 + minutes);
}

function withOffset(d: Date, offsetStr?: string | number): Date {
  const targetMinutes = parseOffset(offsetStr);
  // current local offset in minutes
  const localOffset = -d.getTimezoneOffset(); // getTimezoneOffset is minutes behind UTC, but negative sign
  // compute delta to apply to time (target - local)
  const delta = (targetMinutes - localOffset) * 60000;
  return new Date(d.getTime() + delta);
}

function looksLikeOffset(value: any): value is string | number {
  if (typeof value === 'number') return true;
  if (typeof value !== 'string') return false;
  return /^([+-]?)(\d{1,2}):?(\d{2})$/.test(value);
}

function fmtDate(
  d: Date,
  opts: Intl.DateTimeFormatOptions,
  locale = 'en-US',
  timeZone?: string,
) {
  try {
    const options = timeZone ? { ...opts, timeZone } : opts;
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch (e) {
    return d.toLocaleString();
  }
}

function formatByStyle(d: Date, style: FormatStyle, locale = 'en-US', timeZone?: string) {
  switch (style) {
    case 'half':
      return fmtDate(d, { month: 'short', day: '2-digit' }, locale, timeZone);
    case 'short':
      return fmtDate(d, { month: 'short', day: '2-digit', year: 'numeric' }, locale, timeZone);
    case 'primary':
      return fmtDate(d, { month: 'long', day: '2-digit', year: 'numeric' }, locale, timeZone);
    case 'secondary':
      // Secondary matches short in formatting but may differ via locale tokens
      return fmtDate(d, { month: 'short', day: '2-digit', year: 'numeric' }, locale, timeZone);
    case 'month':
      return fmtDate(d, { month: 'long', year: 'numeric' }, locale, timeZone);
    default:
      return fmtDate(d, { month: 'short', day: '2-digit', year: 'numeric' }, locale, timeZone);
  }
}

function mapFormatKey(key?: string): FormatStyle {
  if (!key) return 'secondary';
  const normalized = String(key).toUpperCase();
  switch (normalized) {
    case 'HALF':
    case 'HALF_DATE_FORMAT':
      return 'half';
    case 'SHORT':
    case 'SHORT_DATE_FORMAT':
      return 'short';
    case 'PRIMARY':
    case 'PRIMARY_DATE_FORMAT':
      return 'primary';
    case 'MONTH':
      return 'month';
    case 'SECONDARY':
    case 'SECONDARY_SHORT_DATE_FORMAT':
    default:
      return 'secondary';
  }
}

function formatHalfDate(date: any) {
  const d = safeDate(date);
  if (!d) return '';
  return formatByStyle(d, 'half');
}

function formatHalfDateWithOffset(date: any, offset = '+5:30') {
  const d = safeDate(date);
  if (!d) return '';
  return formatByStyle(withOffset(d, offset), 'half');
}

function formatDate(date: any) {
  const d = safeDate(date);
  if (!d) return '';
  return formatByStyle(d, 'short');
}

function formatDateWithOffset(date: any, offset = '+5:30') {
  const d = safeDate(date);
  if (!d) return '';
  return formatByStyle(withOffset(d, offset), 'primary');
}

function formateShortDateWithOffset(date: any, offset = '+5:30') {
  const d = safeDate(date);
  if (!d) return '';
  return formatByStyle(withOffset(d, offset), 'short');
}

function formatDateTime(date: any) {
  const d = safeDate(date);
  if (!d) return '';
  const datePart = formatByStyle(d, 'short');
  const timePart = fmtDate(d, { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${datePart} | ${timePart}`;
}

function formatShortDateTime(date: any) {
  const d = safeDate(date);
  if (!d) return '';
  const datePart = formatByStyle(d, 'half');
  const timePart = fmtDate(d, { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${datePart}, ${timePart}`;
}

function formatFullDate(date: any, format = undefined) {
  const d = safeDate(date);
  if (!d) return '';
  return formatByStyle(d, 'short');
}

function formatFullDateWithOffset(date: any, offset = '+5:30', format = undefined) {
  const d = safeDate(date);
  if (!d) return '';
  return formatByStyle(withOffset(d, offset), 'short');
}

function formateDateWithOffset(date: any, offset = '+5:30') {
  return formateShortDateWithOffset(date, offset);
}

function formatDateInTimeZone(date: any, timeZone = 'UTC', formatKey?: string) {
  const d = safeDate(date);
  if (!d) return '';
  const style = mapFormatKey(formatKey);
  return formatByStyle(d, style, 'en-US', timeZone);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function formatDateAddDays(date: any, days: any, offset?: string | number) {
  const d = safeDate(date);
  if (!d) return '';
  const dayCount = Number(days);
  if (Number.isNaN(dayCount)) return '';

  const adjusted = addDays(d, dayCount);
  const targetDate = looksLikeOffset(offset) ? withOffset(adjusted, offset) : adjusted;
  return formatByStyle(targetDate, 'short', 'en-US');
}

function addDaysISO(date: any, days: any) {
  const d = safeDate(date);
  if (!d) return '';
  const dayCount = Number(days);
  if (Number.isNaN(dayCount)) return '';
  return addDays(d, dayCount).toISOString();
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTimeSince(date: any) {
  const d = safeDate(date);
  if (!d) return '';
  const now = new Date();
  if (isSameDay(now, d)) {
    const timePart = fmtDate(d, { hour: 'numeric', minute: '2-digit', hour12: true });
    return `Today, ${timePart}`;
  }
  if (now.getFullYear() === d.getFullYear()) {
    return formatHalfDate(d);
  }
  return formatDate(d);
}

function relativeTime(date: any) {
  const d = safeDate(date);
  if (!d) return '';
  const diff = Math.abs(new Date().getTime() - d.getTime());
  const day = 864e5;
  const month = 2592e6;
  const years = 31104e6;
  if (diff < day) return 'today';
  let unit: string;
  if (diff < month) unit = 'days';
  else if (diff < years) unit = 'months';
  else unit = 'years';
  const num = (() => {
    const ms = diff;
    if (unit === 'days') return Math.floor(ms / day);
    if (unit === 'months') return Math.floor(ms / month);
    return Math.floor(ms / years);
  })();
  let unitStr = unit === 'days' ? ' day' : unit === 'months' ? ' month' : ' year';
  if (num > 1) unitStr += 's';
  unitStr += ' ago';
  return `${num}${unitStr}`;
}

function register() {
  const HB = getHB();
  if (!HB) return;

  HB.registerHelper('formatDate', function (date: any) { return formatDate(date); });
  HB.registerHelper('formatDateWithOffset', function (date: any, offset: any) { return formatDateWithOffset(date, offset); });
  HB.registerHelper('formateShortDateWithOffset', function (date: any, offset: any) { return formateShortDateWithOffset(date, offset); });
  HB.registerHelper('formatHalfDate', function (date: any) { return formatHalfDate(date); });
  HB.registerHelper('formatHalfDateWithOffset', function (date: any, offset: any) { return formatHalfDateWithOffset(date, offset); });
  HB.registerHelper('formatDateTime', function (date: any) { return formatDateTime(date); });
  HB.registerHelper('formatShortDateTime', function (date: any) { return formatShortDateTime(date); });
  HB.registerHelper('formatFullDate', function (date: any) { return formatFullDate(date); });
  HB.registerHelper('formatFullDateWithOffset', function (date: any, offset: any) { return formatFullDateWithOffset(date, offset); });
  HB.registerHelper('formatTimeSince', function (date: any) { return formatTimeSince(date); });
  HB.registerHelper('relativeTime', function (date: any) { return relativeTime(date); });
  HB.registerHelper('formateDateWithOffset', function (date: any, offset: any) { return formateDateWithOffset(date, offset); });
  HB.registerHelper('formatDateInTimeZone', function (date: any, timeZone: any, formatKey: any) {
    return formatDateInTimeZone(date, timeZone, formatKey);
  });
  HB.registerHelper('formatDateAddDays', function (date: any, days: any, offset: any) {
    return formatDateAddDays(date, days, offset);
  });
  HB.registerHelper('addDays', function (date: any, days: any) {
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

try { register(); } catch (_) { /* noop */ }

export {};
