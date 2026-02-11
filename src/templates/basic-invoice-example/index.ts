// @ts-ignore - compiled via handlebars-loader
import template from "./template.hbs";
import "./styles.css";
// Register widgets (ensures InvoiceStatus partial is available and its CSS extracted)
import "../../widgets/invoice-status";
import "../../widgets/demo-badge";
import "../../widgets/date-time";
import "../../widgets/markdown-viewer";

// Export template to global for main renderer to consume
window.CeresTemplate = template;
