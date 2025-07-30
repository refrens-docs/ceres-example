const allowedTemplates = ["basic-invoice-example"]; // Add all your template dirs

// --- Utility Functions ---
function decodeBase64(encodedString) {
  try {
    // Simply decode from Base64.
    // The original URL should be a valid URL string *before* Base64 encoding.
    return atob(encodedString);
  } catch (e) {
    console.error("Failed to decode Base64 string:", e);
    return null;
  }
}

// --- Data Mapping Function (corrected item fields, just to be sure) ---
const mapDataToTemplateModel = (apiData) => {
  // Helper for currency formatting
  const formatCurrency = (value) => {
    if (typeof value !== "number") value = Number(value) || 0;
    return value.toLocaleString("en-IN", {
      style: "currency",
      currency: apiData.currency || "INR",
      minimumFractionDigits: 2,
    });
  };

  // Helper for date formatting
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Discount (find first negative multiplier or label Discount)
  let discount = 0;
  if (Array.isArray(apiData.additionalCharges)) {
    const disc = apiData.additionalCharges.find(
      (c) =>
        c.multiplier === -1 ||
        (c.label && c.label.toLowerCase().includes("discount")),
    );
    if (disc) discount = disc.amount || 0;
  }

  // Subtotal, IGST, Total from items
  const items = Array.isArray(apiData.items) ? apiData.items : [];
  const subTotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const igst = items.reduce((sum, item) => sum + (item.igst || 0), 0);
  const total = items.reduce((sum, item) => sum + (item.total || 0), 0);

  // Due date formatting
  const formattedDueDate = formatDate(apiData.dueDate);

  // Map items for template
  const mappedItems = items.map((item) => ({
    name: item.name || "",
    description: item.description || "",
    quantity: item.quantity || 0,
    rate: item.rate || item.unitPrice || 0,
    gstRate: item.gstRate || item.taxRate || 0,
    amount: item.amount || 0,
    igst: item.igst || item.taxAmount || 0,
    total: item.total || 0,
    formattedRate: formatCurrency(item.rate || item.unitPrice || 0),
    formattedAmount: formatCurrency(item.amount || 0),
    formattedIgst: formatCurrency(item.igst || item.taxAmount || 0),
    formattedTotal: formatCurrency(item.total || 0),
  }));

  // Totals for template
  const formattedSubTotal = formatCurrency(subTotal);
  const formattedDiscount = formatCurrency(discount);
  const formattedIgst = formatCurrency(igst);
  const formattedTotal = formatCurrency(total);

  return {
    // Invoice details
    invoiceNumber: apiData.invoiceNumber || "",
    invoiceDateUserInput:
      apiData.invoiceDateUserInput || formatDate(apiData.invoiceDate),
    formattedDueDate,
    purchaseOrderNumber: apiData.purchaseOrderNumber || "",

    // Custom labels
    customLabels: {
      invoiceNumber: apiData.customLabels?.invoiceNumber || "Invoice No",
      invoiceDate: apiData.customLabels?.invoiceDate || "Invoice Date",
      dueDate: apiData.customLabels?.dueDate || "Due Date",
      purchaseOrderNumber:
        apiData.customLabels?.purchaseOrderNumber || "PO Number",
      terms: apiData.customLabels?.terms || "Terms and Conditions",
      notes: apiData.customLabels?.notes || "Additional Notes",
      billedBy: apiData.customLabels?.billedBy || "Billed By",
      billedTo: apiData.customLabels?.billedTo || "Billed To",
      total: apiData.customLabels?.total || "Total",
      subTotal: apiData.customLabels?.subTotal || "Sub Total",
      totalInWords: apiData.customLabels?.totalInWords || "Total (in words)",
      totalInWordsValue:
        apiData.customLabels?.totalInWordsValue ||
        "Amount in words not available",
    },

    // Parties
    billedBy: {
      name: apiData.owner?.billedTo?.name || "",
      street: apiData.owner?.billedTo?.street || "",
      city: apiData.owner?.billedTo?.city || "",
      pincode: apiData.owner?.billedTo?.pincode || "",
      state: apiData.owner?.billedTo?.state || "",
      country: apiData.owner?.billedTo?.country || "",
      vatNumber:
        apiData.owner?.billedTo?.gstin ||
        apiData.owner?.billedTo?.vatNumber ||
        "",
      vatLabel: apiData.owner?.billedTo?.gstin ? "GSTIN" : "VAT Number",
    },
    billedTo: {
      name: apiData.billedTo?.name || "",
      street: apiData.billedTo?.street || "",
      city: apiData.billedTo?.city || "",
      pincode: apiData.billedTo?.pincode || "",
      state: apiData.billedTo?.state || "",
      country: apiData.billedTo?.country || "",
      gstin: apiData.billedTo?.gstin || "",
    },

    // Items
    items: mappedItems,

    // Totals
    totals: {
      subTotal,
      discount,
      igst,
      total,
    },
    formattedSubTotal,
    formattedDiscount,
    formattedIgst,
    formattedTotal,

    // Notes & Terms
    notes: apiData.notes || "",
    terms:
      Array.isArray(apiData.terms) &&
        apiData.terms[0] &&
        Array.isArray(apiData.terms[0].terms)
        ? apiData.terms[0].terms
        : [],

    // Other
    currency: apiData.currency || "INR",
    companyLogoUrl: apiData.logo || "",
  };
};

// --- Main Rendering Logic ---
async function renderDocument() {
  const urlParams = new URLSearchParams(window.location.search);
  const templatePath = urlParams.get("template"); // e.g., 'basic-invoice-example'
  const encodedApiUrl = urlParams.get("apiUrl");

  const outputDiv = document.getElementById("documentOutput");

  console.log("Attempting to render document...");
  console.log("Template Path from URL:", templatePath);
  console.log("Encoded API URL from URL:", encodedApiUrl);

  if (!templatePath) {
    outputDiv.innerHTML = `<div class="error-message">Error: 'template' query parameter is missing. Please specify a template directory (e.g., ?template=basic-invoice-example).</div>`;
    console.error("Validation Error: 'template' query parameter is missing.");
    return;
  }

  if (!allowedTemplates.includes(templatePath)) {
    outputDiv.innerHTML = `<div class="error-message">Error: Invalid or unpermitted template specified.</div>`;
    console.error(
      "Validation Error: Invalid or unpermitted template:",
      templatePath,
    );
    return;
  }

  if (!encodedApiUrl) {
    outputDiv.innerHTML = `<div class="error-message">Error: 'apiUrl' query parameter is missing or empty. Please provide a Base64 encoded API URL.</div>`;
    console.error("Validation Error: 'apiUrl' query parameter is missing.");
    return;
  }

  const API_ENDPOINT = decodeBase64(encodedApiUrl);

  if (!API_ENDPOINT) {
    outputDiv.innerHTML = `<div class="error-message">Error: Could not decode API URL from 'apiUrl' parameter.</div>`;
    console.error("Validation Error: Could not decode API URL.");
    return;
  }

  try {
    console.log(`Fetching template from: ${templatePath}/template.html`); // 1. Load the template HTML
    const templateResponse = await fetch(`${templatePath}/template.html`);
    if (!templateResponse.ok) {
      const errorText = await templateResponse.text();
      throw new Error(
        `Failed to load template from ${templatePath}/template.html. Status: ${templateResponse.status}. Details: ${errorText.substring(0, 100)}...`,
      );
    }
    const templateHtml = await templateResponse.text();
    console.log("Template HTML fetched successfully.");

    console.log(`Attempting to load stylesheet: ${templatePath}/styles.css`); // 2. Load and apply the stylesheet
    const existingStyleLink = document.querySelector(
      `link[href="${templatePath}/styles.css"]`,
    );
    if (!existingStyleLink) {
      const styleLink = document.createElement("link");
      styleLink.rel = "stylesheet";
      styleLink.href = `${templatePath}/styles.css`;
      document.head.appendChild(styleLink);
      console.log("Stylesheet link added.");
    } else {
      console.log("Stylesheet link already exists, skipping addition.");
    }

    console.log(`Fetching API data from: ${API_ENDPOINT}`); // THIS LOG WILL NOW SHOW THE CORRECT, DECODED URL
    // 3. Fetch the data from the API
    const apiResponse = await fetch(API_ENDPOINT);
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(
        `HTTP error! status: ${apiResponse.status} from ${API_ENDPOINT}. Details: ${errorText.substring(0, 100)}...`,
      );
    }
    const apiData = await apiResponse.json();
    console.log("API data fetched successfully:", apiData); // 4. Map the API data to the template model

    const dataForTemplate = mapDataToTemplateModel(apiData);
    console.log("Data mapped for template:", dataForTemplate); // 5. Render the document

    outputDiv.innerHTML = Mustache.render(templateHtml, dataForTemplate);
    console.log("Document rendered successfully!");
  } catch (error) {
    console.error("Error fetching or rendering document:", error);
    outputDiv.innerHTML = `<div class="error-message">Error loading document: ${error.message}.</div>`;
  }
}

// Call the main rendering function when the page loads
renderDocument();
