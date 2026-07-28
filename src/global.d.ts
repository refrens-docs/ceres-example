
declare global {
  interface Window {
    Handlebars?: any;
    CeresTemplate?: (data: any) => string; // Currently loaded template function
    CeresWidgets?: any;
  }
}

export { };
