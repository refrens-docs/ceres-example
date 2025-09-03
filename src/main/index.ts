(function () {
  // Simple base64 decoder
  function decodeBase64(encoded: any) {
    try { return atob(encoded); } catch (e) { return null; }
  }

  function getQueryParam(key: any) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  }

  function loadScript(src: any) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = src;
      s.onload = function () { resolve(null); };
      s.onerror = function () { reject(new Error("Failed to load " + src)); };
      document.head.appendChild(s);
    });
  }

  function loadCSS(href: any) {
    return new Promise(function (resolve, reject) {
      // Check if CSS is already loaded
      const existing = document.querySelector('link[href="' + href + '"]');
      if (existing) {
        resolve(null);
        return;
      }
      
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = function () { resolve(null); };
      link.onerror = function () { reject(new Error("Failed to load CSS: " + href)); };
      document.head.appendChild(link);
    });
  }

  function ensureHandlebarsRuntime() {
    return new Promise(function (resolve, reject) {
      if ((window as any).Handlebars) return resolve(null);
      const s = document.createElement("script");
      // CDN for Handlebars runtime (UMD)
      s.src = "https://cdn.jsdelivr.net/npm/handlebars@4.7.8/dist/handlebars.runtime.min.js";
      s.onload = function () { resolve(null); };
      s.onerror = function () { reject(new Error("Failed to load Handlebars runtime")); };
      document.head.appendChild(s);
    });
  }

  async function renderDocument() {
    const allowedTemplates = ["invoice", "basic-invoice-example"]; // extend as you add templates
    const templateName = getQueryParam("template");
    const encodedApiUrl = getQueryParam("apiUrl");
    const outputDiv = document.getElementById("documentOutput");

    if (!templateName) {
      outputDiv && (outputDiv.innerHTML = "Error: missing ?template=");
      return;
    }
    if (!allowedTemplates.includes(templateName)) {
      outputDiv && (outputDiv.innerHTML = "Error: invalid template");
      return;
    }
    if (!encodedApiUrl) {
      outputDiv && (outputDiv.innerHTML = "Error: missing ?apiUrl=");
      return;
    }
    const API_ENDPOINT = decodeBase64(encodedApiUrl);
    if (!API_ENDPOINT) {
      outputDiv && (outputDiv.innerHTML = "Error: could not decode apiUrl");
      return;
    }

    // NEW: Fetch per-template manifest (was global template-manifest.json)
    let manifest;
    try {
      const resp = await fetch(`dist/templates/${templateName}/manifest.json`);
      if (!resp.ok) throw new Error("manifest fetch failed");
      manifest = await resp.json(); // { js, css }
    } catch (e) {
      outputDiv && (outputDiv.innerHTML = "Error: could not load template manifest");
      return;
    }

    if (!manifest || !manifest.js) {
      outputDiv && (outputDiv.innerHTML = "Error: invalid template manifest");
      return;
    }

    // load handlebars runtime + the chosen template bundle (self-contained)
    await ensureHandlebarsRuntime();
    const loaders = [loadScript(`dist/${manifest.js}`)];
    if (manifest.css) loaders.push(loadCSS(`dist/${manifest.css}`));
    await Promise.all(loaders);

    // fetch data
    const resp = await fetch(API_ENDPOINT);
    if (!resp.ok) {
      outputDiv && (outputDiv.innerHTML = "Error fetching data: " + resp.status);
      return;
    }
    const data = await resp.json();

    window.CeresTemplates = window.CeresTemplates || {};
    const tmpl = window.CeresTemplates[templateName];
    if (!tmpl) {
      outputDiv && (outputDiv.innerHTML = "Error: template not loaded");
      return;
    }
    const html = tmpl(data);
    if (outputDiv) outputDiv.innerHTML = html;
  }

  renderDocument();
})();

export {};
