// @ts-ignore - compiled via handlebars-loader
import template from "./template.hbs";
import "./styles.css";
// Register widgets (ensures InvoiceStatus partial is available and its CSS extracted)
import "../../widgets/invoice-status";
import "../../widgets/demo-badge";

// Register template in global registry (ambient types in src/types/global.d.ts)
if (!window.CeresTemplates) window.CeresTemplates = {};
window.CeresTemplates["basic-invoice-example"] = template;
