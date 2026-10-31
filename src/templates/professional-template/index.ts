import template from "./template.hbs";
import { normalizeInvoiceTemplateState } from "../../main/invoiceTemplateNormalization";
import {
  registerProfessionalHelpers,
  registerProfessionalImages,
  registerProfessionalPrint,
  registerProfessionalWords,
  withGstColumnLabels,
  withMoneyDefaults,
  withRefrensDefaults,
  withTemplateSettings,
} from "./helpers";
import "./styles.css";
// Register only the widgets template.hbs uses.
import "../../widgets/date-time";
import "../../widgets/markdown-viewer";
import "../../widgets/currency-format";
import "../../widgets/image";
import "../../widgets/subtotal";
import "../../widgets/tax-summary";
import "../../widgets/hsn-summary";
import "../../widgets/payment-table";
import "../../widgets/invoice-status";
import "../../widgets/phone-number";
import "../../widgets/refrens-branding";
import "../../widgets/watermark";

registerProfessionalHelpers(window.Handlebars);
registerProfessionalPrint();
registerProfessionalImages();
registerProfessionalWords();

// Export template to global for main renderer to consume
// Host template settings onto the document, the shared normalizer, then the document's
// decimal places made explicit (helpers.ts).
window.CeresTemplateDataMapper = ((
  payload: Parameters<typeof normalizeInvoiceTemplateState>[0]
) =>
  withMoneyDefaults(
    normalizeInvoiceTemplateState(
      withGstColumnLabels(withRefrensDefaults(withTemplateSettings(payload)))
    )
  )) as any;
window.CeresTemplate = template;
