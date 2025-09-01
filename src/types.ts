// Global type declarations for Ceres
declare global {
  interface Window {
    CeresTemplates?: Record<string, (context: any) => string>;
    Handlebars?: any;
  }
}

export {};
