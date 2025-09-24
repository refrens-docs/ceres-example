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

  function loadScript(src: any) {
    return new Promise(function(resolve, reject) {
      const s = document.createElement("script");
      s.src = src;
      s.onload = function() {
        resolve(null);
      };
      s.onerror = function() {
        reject(new Error("Failed to load " + src));
      };
      document.head.appendChild(s);
    });
  }

  function loadCSS(href: any) {
    return new Promise(function(resolve, reject) {
      // Check if CSS is already loaded
      const existing = document.querySelector('link[href="' + href + '"]');
      if (existing) {
        resolve(null);
        return;
      }

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
    const encodedApiUrl = getQueryParam("apiUrl");
    const outputDiv = document.getElementById("documentOutput");

    if (!encodedApiUrl) {
      outputDiv && (outputDiv.innerHTML = "Error: missing ?apiUrl=");
      return;
    }
    const API_ENDPOINT = decodeBase64(encodedApiUrl);
    if (!API_ENDPOINT) {
      outputDiv && (outputDiv.innerHTML = "Error: could not decode apiUrl");
      return;
    }

    // Get the template manifest from the global variable set by index.html
    const templateManifest = (window as any).CeresTemplateManifest;
    const templateManifestUrl = (window as any).CeresTemplateManifestUrl;
    
    if (!templateManifest || !templateManifestUrl) {
      outputDiv && (outputDiv.innerHTML = "Error: no template manifest loaded");
      return;
    }

    // Extract assets directly from the root template manifest (no need for second fetch)
    const assets = templateManifest.assets;
    if (!assets || !assets.js) {
      const preview = JSON.stringify(templateManifest).slice(0, 200);
      outputDiv &&
        (outputDiv.innerHTML =
          "Error: could not find JS in template manifest. Preview: " +
          preview +
          "...");
      return;
    }

    // Build absolute URLs for the assets using the template manifest URL as base
    let jsUrl: string;
    let cssUrl: string | undefined;
    
    if (templateManifestUrl.startsWith('http://') || templateManifestUrl.startsWith('https://')) {
      // Absolute URL - use new URL() constructor
      jsUrl = new URL(assets.js, templateManifestUrl).href;
      cssUrl = assets.css ? new URL(assets.css, templateManifestUrl).href : undefined;
    } else {
      // Relative URL - construct manually
      const templateBaseUrl = templateManifestUrl.replace('/manifest.json', '/');
      jsUrl = templateBaseUrl + assets.js.replace('./', '');
      cssUrl = assets.css ? templateBaseUrl + assets.css.replace('./', '') : undefined;
    }

    // load handlebars runtime + the chosen template bundle (self-contained)
    (window as any).CeresCurrentTemplateBundle = jsUrl;
    
    try {
      await Promise.all([
        loadScript(jsUrl),
        cssUrl ? loadCSS(cssUrl) : Promise.resolve(null),
      ]);
    } catch (error: any) {
      outputDiv && (outputDiv.innerHTML = "Error loading template assets: " + error.message);
      return;
    }

    // fetch data
    try {
      const resp = await fetch(API_ENDPOINT);
      if (!resp.ok) {
        outputDiv &&
          (outputDiv.innerHTML = "Error fetching data: " + resp.status);
        return;
      }
      const data = await resp.json();

      // Extract template name from the manifest URL for template lookup
      const templateNameMatch = templateManifestUrl.match(/templates\/([^\/]+)\/manifest\.json/);
      const templateName = templateNameMatch ? templateNameMatch[1] : 'unknown';

      (window as any).CeresTemplates = (window as any).CeresTemplates || {};
      const tmpl = (window as any).CeresTemplates[templateName];
      if (!tmpl) {
        outputDiv && (outputDiv.innerHTML = "Error: template not loaded");
        return;
      }
      const html = tmpl(data);
      if (outputDiv) outputDiv.innerHTML = html;
    } catch (error: any) {
      outputDiv && (outputDiv.innerHTML = "Error: " + error.message);
    }
  }

  renderDocument();
})();

export { };
