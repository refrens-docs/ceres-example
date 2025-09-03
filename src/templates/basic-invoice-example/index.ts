import template from "./template.hbs";
import "./styles.css";

// Register template in global registry (ambient types in src/types/global.d.ts)
if (!window.CeresTemplates) window.CeresTemplates = {};
window.CeresTemplates["basic-invoice-example"] = template;
