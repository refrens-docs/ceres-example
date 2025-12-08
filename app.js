const allowedTemplates = ["basic-invoice-example"]; // Add all your template dirs

// --- Utility Functions ---
function decodeBase64(encodedString) {
  try {
    // Simply decode from Base64.
    // The original URL should be a valid URL string *before* Base64 encoding.
    return atob(encodedString);
  } catch (e) {
    return null;
  }
}

// --- Main Rendering Logic ---
async function renderDocument() {
  const urlParams = new URLSearchParams(window.location.search);
  const templatePath = urlParams.get("template"); // e.g., 'basic-invoice-example'
  const encodedApiUrl = urlParams.get("apiUrl");

  const outputDiv = document.getElementById("documentOutput");

  if (!templatePath) {
    outputDiv.innerHTML = `<div class="error-message">Error: 'template' query parameter is missing. Please specify a template directory (e.g., ?template=basic-invoice-example).</div>`;
    return;
  }

  if (!allowedTemplates.includes(templatePath)) {
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
    const templateResponse = await fetch(`${templatePath}/template.html`);
    if (!templateResponse.ok) {
      const errorText = await templateResponse.text();
      throw new Error(
        `Failed to load template from ${templatePath}/template.html. Status: ${templateResponse.status}. Details: ${errorText.substring(0, 100)}...`,
      );
    }
    const templateHtml = await templateResponse.text();

    const existingStyleLink = document.querySelector(
      `link[href="${templatePath}/styles.css"]`,
    );
    if (!existingStyleLink) {
      const styleLink = document.createElement("link");
      styleLink.rel = "stylesheet";
      styleLink.href = `${templatePath}/styles.css`;
      document.head.appendChild(styleLink);
    }
    // 3. Fetch the data from the API
    const apiResponse = await fetch(API_ENDPOINT);
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(
        `HTTP error! status: ${apiResponse.status} from ${API_ENDPOINT}. Details: ${errorText.substring(0, 100)}...`,
      );
    }
    const apiData = await apiResponse.json();
    
    // Compile the Handlebars template
    const template = Handlebars.compile(templateHtml);
    outputDiv.innerHTML = template(apiData);
  } catch (error) {
    outputDiv.innerHTML = `<div class="error-message">Error loading document: ${error.message}.</div>`;
  }
}

// Call the main rendering function when the page loads
renderDocument();
