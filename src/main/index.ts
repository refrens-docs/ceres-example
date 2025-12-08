(function() {
  // Simple base64 decoder
  function decodeBase64(encoded: any) {
    try {
      return atob(encoded);
    } catch (e) {
      return null;
    }
  }

  function getQueryParam(key: any) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  }

  // Resolve template manifest URL from encoded query parameter
  function resolveTemplateManifestUrl(encodedValue: any) {
    if (!encodedValue) return null;
    
    const decoded = decodeBase64(encodedValue);
    if (!decoded) return null;
    
    // Check if it's a full URL or template name
    if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
      return decoded; // Full URL
    } else {
      // Template name - construct local path
      return './templates/' + decoded + '/manifest.json';
    }
  }

  // Load template manifest from URL
  async function loadTemplateManifest() {
    // Try templateManifest param first, then template param
    const encodedManifestUrl = getQueryParam('templateManifest') || getQueryParam('template');
    
    // Resolve the manifest URL
    const manifestUrl = resolveTemplateManifestUrl(encodedManifestUrl);
    
    if (!manifestUrl) {
      throw new Error(
        'No template specified. Please provide ?template=<name> or ?templateManifest=<base64-url>'
      );
    }
    
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch template manifest from ${manifestUrl}: ${response.status}`);
    }
    
    const manifest = await response.json();
    return { manifest: manifest, url: manifestUrl };
  }

  function loadScript(src: any) {
    return new Promise(function(resolve, reject) {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = function() {
        reject(new Error("Failed to load script: " + src));
      };
      document.head.appendChild(script);
    });
  }

  function loadCSS(href: any) {
    return new Promise(function(resolve, reject) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = function() {
        resolve(null);
      };
      link.onerror = function() {
        reject(new Error("Failed to load CSS: " + href));
      };
      document.head.appendChild(link);
    });
  }

  async function renderDocument() {
    const outputDiv = document.getElementById("documentOutput");

    try {
      // Step 1: Load template manifest
      const { manifest: templateManifest, url: templateManifestUrl } = 
        await loadTemplateManifest();

      // Step 2: Get and decode API URL
      const encodedApiUrl = getQueryParam("apiUrl");
      if (!encodedApiUrl) {
        throw new Error("Missing required parameter: ?apiUrl=<base64-encoded-url>");
      }
      
      const API_ENDPOINT = decodeBase64(encodedApiUrl);
      if (!API_ENDPOINT) {
        throw new Error("Could not decode apiUrl parameter");
      }

      // Step 3: Extract and validate template assets
      const assets = templateManifest.assets;
      if (!assets || !assets.js) {
        throw new Error(
          "Template manifest does not contain required 'assets.js' field"
        );
      }

      // Step 4: Build absolute URLs for template assets
      const manifestBaseUrl = templateManifestUrl.substring(
        0,
        templateManifestUrl.lastIndexOf("/")
      );
      const jsUrl = manifestBaseUrl + "/" + assets.js;
      const cssUrl = assets.css ? manifestBaseUrl + "/" + assets.css : null;

      // Step 5: Load template bundle (JS + CSS if present)
      await Promise.all([
        loadScript(jsUrl),
        cssUrl ? loadCSS(cssUrl) : Promise.resolve(null),
      ]);

      // Step 6: Fetch API data
      const response = await fetch(API_ENDPOINT);
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      const data = await response.json();

      // Step 7: Get the loaded template and render
      const template = (window as any).CeresTemplate;
      if (!template) {
        throw new Error(
          "Template bundle did not export window.CeresTemplate. " +
            "The template bundle may have failed to load or initialize properly."
        );
      }
      
      const html = template(data);
      if (outputDiv) {
        outputDiv.innerHTML = html;
      }
      
    } catch (error: any) {
      console.error("Error rendering document:", error);
      if (outputDiv) {
        outputDiv.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
      }
    }
  }

  renderDocument();
})();

export { };
