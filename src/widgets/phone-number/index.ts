import { parsePhoneNumberFromString } from "libphonenumber-js";

function formatPhoneNumberIntl(phone: string): string | undefined {
  const normalized = phone.slice(0, 1) === "+" ? phone : `+${phone}`;
  const parsed = parsePhoneNumberFromString(normalized);
  const formatted = parsed?.formatInternational();
  // Wrap with LTR isolate characters to prevent RTL distortion (same as disco)
  return formatted ? `⁦${formatted}⁩` : undefined;
}

function getHB(): any {
  return (window as any).Handlebars;
}

function register() {
  const HB = getHB();
  if (!HB) return;

  HB.registerHelper("formatPhoneNumber", (phone: any) => {
    if (!phone) return "";
    return formatPhoneNumberIntl(String(phone)) ?? String(phone);
  });

  (window as any).CeresWidgets = (window as any).CeresWidgets || {};
  (window as any).CeresWidgets.PhoneNumber = { register };
}

try {
  register();
} catch (_) {
  /* noop */
}

export {};
