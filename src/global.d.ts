declare module "*.hbs" {
  const template: (data: any) => string;
  export default template;
}

declare module "*.css" {
  const css: string;
  export default css;
}

declare global {
  interface Window {
    Handlebars?: any;
    CeresTemplates?: Record<string, (data: any) => string>;
    CeresWidgets?: any;
  }
}

export {};
