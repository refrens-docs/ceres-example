import template from "./template.hbs";
import "./styles.css";

// Global type declarations
declare global {
  interface Window {
    CeresTemplates?: Record<string, (context: any) => string>;
  }
}

// Initialize the global CeresTemplates object
window.CeresTemplates = window.CeresTemplates || {};

// Register this template
window.CeresTemplates["basic-invoice-example"] = template;
