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

  function getDistBase(): string {
    return "dist/";
  }

  // Try a list of possible manifest filenames within a template folder
  async function fetchTemplateManifest(templateDir: string): Promise<any> {
    const MANIFEST_PATH = "manifest.json";
    try {
      const r = await fetch(templateDir + MANIFEST_PATH);
      if (r && r.ok) return r.json();
    } catch (_) {
      /* continue */
    }
    throw new Error("No template manifest found in " + templateDir);
  }

  // Find first .js and .css strings anywhere within a manifest object/array/string
  function findAssetPaths(man: any): { js?: string; css?: string } {
    let js: string | undefined;
    let css: string | undefined;

    function scan(v: any) {
      if (js && css) return; // early exit when both found
      if (!v) return;
      const t = typeof v;
      if (t === "string") {
        if (!js && /\.js($|\?)/.test(v)) js = v;
        else if (!css && /\.css($|\?)/.test(v)) css = v;
        return;
      }
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          scan(v[i]);
          if (js && css) break;
        }
        return;
      }
      if (t === "object") {
        // Common direct shapes first
        if (!js && typeof v.js === "string") js = v.js;
        if (!css && typeof v.css === "string") css = v.css;
        // Then scan all values
        const keys = Object.keys(v);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          scan(v[k]);
          if (js && css) break;
        }
      }
    }

    scan(man);
    return { js, css };
  }

  // Make a possibly-relative asset path absolute using dist base and template dir
  function toAbsoluteAssetPath(
    pathLike: string,
    distBase: string,
    templateDir: string,
  ): string {
    if (!pathLike) return pathLike;
    // Absolute URL
    if (/^https?:\/\//i.test(pathLike)) return pathLike;
    // If it already points into dist/templates/, keep relative to dist base
    if (pathLike.startsWith("templates/")) return distBase + pathLike;
    // If it looks already rooted within dist/ (rare), also prefix dist base
    if (pathLike.startsWith("/")) return distBase + pathLike.replace(/^\//, "");
    // Otherwise, assume it's a file within the template folder (e.g., bundle.hash.js)
    return templateDir + pathLike;
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

    const distBase = getDistBase();

    // Per-template manifest: dist/templates/{templateName}/<manifest>.json
    const templateDir = distBase + `templates/${templateName}/`;
    let templateManifest: any;
    try {
      templateManifest = await fetchTemplateManifest(templateDir);
    } catch (e: any) {
      outputDiv &&
        (outputDiv.innerHTML =
          "Error: " +
          (e && e.message ? e.message : "template manifest not found"));
      return;
    }

    // Extract js/css from whatever structure the manifest uses
    const found = findAssetPaths(templateManifest);
    if (!found.js) {
      const preview = JSON.stringify(templateManifest).slice(0, 200);
      outputDiv &&
        (outputDiv.innerHTML =
          "Error: could not find JS in template manifest. Preview: " +
          preview +
          "...");
      return;
    }

    const jsUrl = toAbsoluteAssetPath(found.js, distBase, templateDir);
    const cssUrl = found.css
      ? toAbsoluteAssetPath(found.css, distBase, templateDir)
      : undefined;

    // load handlebars runtime + the chosen template bundle (self-contained)
    // await ensureHandlebarsRuntime();
    (window as any).CeresCurrentTemplateBundle = jsUrl;
    await Promise.all([
      loadScript(jsUrl),
      cssUrl ? loadCSS(cssUrl) : Promise.resolve(null),
    ]);

    // fetch data
    const resp = await fetch(API_ENDPOINT);
    if (!resp.ok) {
      outputDiv &&
        (outputDiv.innerHTML = "Error fetching data: " + resp.status);
      return;
    }
    const data = await resp.json();

    window.CeresTemplates = window.CeresTemplates || {};
    console.log("CeresTemplates", window.CeresTemplates);
    const tmpl = window.CeresTemplates[templateName];
    console.log({ tmpl });
    if (!tmpl) {
      outputDiv && (outputDiv.innerHTML = "Error: template not loaded");
      return;
    }
    const html = tmpl(data);
    if (outputDiv) outputDiv.innerHTML = html;
  }

  renderDocument();
})();

export { };
