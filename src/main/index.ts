import { initLydiaBridge } from './lydiaBridge';

const OUTPUT_ELEMENT_ID = 'documentOutput';

const decodeBase64 = (encoded: string | null): string | null => {
  if (!encoded) {
    return null;
  }

  try {
    return atob(encoded);
  } catch (error) {
    return null;
  }
};

const getQueryParam = (key: string): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
};

const resolveTemplateManifestUrl = (encodedValue: string | null): string | null => {
  if (!encodedValue) {
    return null;
  }

  const decoded = decodeBase64(encodedValue);
  if (!decoded) {
    return null;
  }

  if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
    return decoded;
  }

  return `./templates/${decoded}/manifest.json`;
};

const loadTemplateManifest = async () => {
  const encodedManifestUrl = getQueryParam('templateManifest') || getQueryParam('template');
  const manifestUrl = resolveTemplateManifestUrl(encodedManifestUrl);

  if (!manifestUrl) {
    throw new Error('No template specified. Please provide ?template=<name> or ?templateManifest=<base64-url>');
  }

  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch template manifest from ${manifestUrl}: ${response.status}`);
  }

  const manifest = await response.json();
  return { manifest, url: manifestUrl };
};

const loadScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });

const loadCSS = (href: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
    document.head.appendChild(link);
  });

const lydiaBridge = initLydiaBridge({ outputElementId: OUTPUT_ELEMENT_ID });

const renderDocument = async () => {
  const outputDiv = document.getElementById(OUTPUT_ELEMENT_ID);

  try {
    const { manifest: templateManifest, url: templateManifestUrl } = await loadTemplateManifest();

    const encodedApiUrl = getQueryParam('apiUrl');
    if (!encodedApiUrl) {
      throw new Error('Missing required parameter: ?apiUrl=<base64-encoded-url>');
    }

    const apiEndpoint = decodeBase64(encodedApiUrl);
    if (!apiEndpoint) {
      throw new Error('Could not decode apiUrl parameter');
    }

    const assets = templateManifest.assets;
    if (!assets || !assets.js) {
      throw new Error("Template manifest does not contain required 'assets.js' field");
    }

    const manifestBaseUrl = templateManifestUrl.substring(0, templateManifestUrl.lastIndexOf('/'));
    const jsUrl = `${manifestBaseUrl}/${assets.js}`;
    const cssUrl = assets.css ? `${manifestBaseUrl}/${assets.css}` : null;

    await Promise.all([loadScript(jsUrl), cssUrl ? loadCSS(cssUrl) : Promise.resolve()]);

    const response = await fetch(apiEndpoint);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const template = (window as any).CeresTemplate;

    if (typeof template !== 'function') {
      throw new Error(
        'Template bundle did not export window.CeresTemplate. The template bundle may have failed to load or initialize properly.',
      );
    }

    const html = template(data);
    if (outputDiv) {
      outputDiv.innerHTML = html;
      outputDiv.classList.remove('loading-message');
    }

    lydiaBridge?.reportContentHeight('render');
  } catch (error: any) {
    console.error('Error rendering document:', error);
    if (outputDiv) {
      outputDiv.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
      outputDiv.classList.remove('loading-message');
    }
    lydiaBridge?.reportContentHeight('error');
  }
};

void renderDocument();

export {};
