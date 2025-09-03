// Global ambient declarations for Ceres
// Consolidates previous scattered declare global blocks.

export {};

declare global {
  interface Window {
    CeresTemplates?: Record<string, (context: any) => string>;
    Widgets?: any;
    Handlebars?: any;
  }
}
