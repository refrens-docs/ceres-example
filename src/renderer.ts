import './types';

const allowedTemplates = ["basic-invoice-example"]; // Add all your template dirs

// --- Utility Functions ---
function decodeBase64(encodedString: string): string | null {
  try {
    // Simply decode from Base64.
    // The original URL should be a valid URL string *before* Base64 encoding.
    return atob(encodedString);
  } catch (e) {
    return null;
  }
}

// Dynamic loading of template bundles
async function loadTemplate(templateName: string): Promise<void> {
  // Load the template bundle JavaScript
  const scriptElement = document.createElement('script');
  scriptElement.src = `dist/templates/${templateName}/bundle.js`;
  scriptElement.async = true;
  
  return new Promise((resolve, reject) => {
    scriptElement.onload = () => resolve();
    scriptElement.onerror = () => reject(new Error(`Failed to load template: ${templateName}`));
    document.head.appendChild(scriptElement);
  });
}

// Dynamic loading of template CSS
async function loadTemplateCSS(templateName: string): Promise<void> {
  // Check if CSS is already loaded
  const existingLink = document.querySelector(`link[href="dist/templates/${templateName}/bundle.css"]`);
  if (existingLink) return;

  const linkElement = document.createElement('link');
  linkElement.rel = 'stylesheet';
  linkElement.href = `dist/templates/${templateName}/bundle.css`;
  
  return new Promise((resolve, reject) => {
    linkElement.onload = () => resolve();
    linkElement.onerror = () => reject(new Error(`Failed to load CSS for template: ${templateName}`));
    document.head.appendChild(linkElement);
  });
}

// --- Main Rendering Logic ---
async function renderDocument(): Promise<void> {
  const urlParams = new URLSearchParams(window.location.search);
  const templatePath = urlParams.get("template"); // e.g., 'basic-invoice-example'
  const encodedApiUrl = urlParams.get("apiUrl");

  const outputDiv = document.getElementById("documentOutput");
  if (!outputDiv) {
    console.error("Document output element not found");
    return;
  }

  if (!templatePath) {
    outputDiv.innerHTML = `<div class="error-message">Error: 'template' query parameter is missing. Please specify a template directory (e.g., ?template=basic-invoice-example).</div>`;
    return;
  }

  if (allowedTemplates.indexOf(templatePath) === -1) {
    outputDiv.innerHTML = `<div class="error-message">Error: Invalid or unpermitted template specified.</div>`;
    return;
  }

  if (!encodedApiUrl) {
    outputDiv.innerHTML = `<div class="error-message">Error: 'apiUrl' query parameter is missing or empty. Please provide a Base64 encoded API URL.</div>`;
    return;
  }

  const API_ENDPOINT = decodeBase64(encodedApiUrl);

  if (!API_ENDPOINT) {
    outputDiv.innerHTML = `<div class="error-message">Error: Could not decode API URL from 'apiUrl' parameter.</div>`;
    return;
  }

  try {
    // Load template bundle and CSS
    await Promise.all([
      loadTemplate(templatePath),
      loadTemplateCSS(templatePath)
    ]);

    // Fetch the data from the API
    const apiResponse = await fetch(API_ENDPOINT);
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(
        `HTTP error! status: ${apiResponse.status} from ${API_ENDPOINT}. Details: ${errorText.substring(0, 100)}...`,
      );
    }
    const apiData = await apiResponse.json();

    // Initialize CeresTemplates if not exists
    if (!window.CeresTemplates) {
      throw new Error("Template bundle failed to register properly");
    }

    // Get the template function
    const templateFunction = window.CeresTemplates[templatePath];
    if (!templateFunction) {
      throw new Error(`Template '${templatePath}' not found in loaded bundle`);
    }

    // Render the template with Handlebars
    const renderedHtml = templateFunction(apiData);
    outputDiv.innerHTML = renderedHtml;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputDiv.innerHTML = `<div class="error-message">Error loading document: ${errorMessage}.</div>`;
  }
}

// Call the main rendering function when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderDocument);
} else {
  renderDocument();
}
