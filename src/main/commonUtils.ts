const GOOGLE_FONT_WEIGHTS = '300;400;500;600;700';

type RGBAColor = { r: number; g: number; b: number; a?: number };

type PlainObject = Record<string, unknown>;

export const decodeBase64 = (encoded: string | null): string | null => {
  if (!encoded) {
    return null;
  }

  try {
    return atob(encoded);
  } catch (error) {
    return null;
  }
};

export const getQueryParam = (key: string): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get(key);
};

export const resolveTemplateManifestUrl = (encodedValue: string | null): string | null => {
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

export const loadTemplateManifest = async () => {
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

export const loadScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });

export const loadCSS = (href: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
    document.head.appendChild(link);
  });

export const waitForImages = (container: HTMLElement | null, timeoutMs = 2000): Promise<void> =>
  new Promise((resolve) => {
    if (!container) {
      resolve();
      return;
    }

    const images = Array.from(container.querySelectorAll('img'));
    if (images.length === 0) {
      resolve();
      return;
    }

    let pending = images.length;
    let resolved = false;

    const finish = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve();
    };

    const onImageDone = () => {
      pending -= 1;
      if (pending <= 0) {
        finish();
      }
    };

    images.forEach((image) => {
      if (image.complete) {
        onImageDone();
        return;
      }

      image.addEventListener('load', onImageDone, { once: true });
      image.addEventListener('error', onImageDone, { once: true });
    });

    window.setTimeout(finish, timeoutMs);
  });

export const isPlainObject = (value: unknown): value is PlainObject => {
  if (value === null) {
    return false;
  }

  return typeof value === 'object' && !Array.isArray(value);
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isRGBAColor = (value: unknown): value is RGBAColor => {
  if (!isPlainObject(value)) {
    return false;
  }

  const { r, g, b } = value as PlainObject;
  return isFiniteNumber(r) && isFiniteNumber(g) && isFiniteNumber(b);
};

const toCssColor = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!isRGBAColor(value)) {
    return null;
  }

  const red = clamp(Math.round(value.r), 0, 255);
  const green = clamp(Math.round(value.g), 0, 255);
  const blue = clamp(Math.round(value.b), 0, 255);
  const alpha = value.a;

  if (!isFiniteNumber(alpha)) {
    return `rgb(${red}, ${green}, ${blue})`;
  }

  const normalizedAlpha = Math.round(clamp(alpha, 0, 1) * 1000) / 1000;
  return `rgba(${red}, ${green}, ${blue}, ${normalizedAlpha})`;
};

const normalizeFontName = (font: string | undefined): string | null => {
  if (!font) {
    return null;
  }

  const trimmed = font.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ensureGoogleFontLoaded = (fontName: string) => {
  const normalized = normalizeFontName(fontName);
  if (!normalized) {
    return;
  }

  const id = `ceres-font-${normalized.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) {
    return;
  }

  const fontFamilyParam = encodeURIComponent(normalized).replace(/%20/g, '+');
  const href = `https://fonts.googleapis.com/css2?family=${fontFamilyParam}:wght@${GOOGLE_FONT_WEIGHTS}&display=swap`;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute('data-ceres-font', normalized);
  document.head.appendChild(link);
};

export const mergeInto = (target: unknown, source: unknown): PlainObject => {
  const base = isPlainObject(target) ? target : {};

  if (!isPlainObject(source)) {
    return base;
  }

  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (isPlainObject(value)) {
      base[key] = mergeInto(base[key], value);
      return;
    }

    if (Array.isArray(value)) {
      base[key] = value.map((item) =>
        isPlainObject(item) ? mergeInto({}, item) : item,
      );
      return;
    }

    base[key] = value;
  });

  return base;
};

export const parsePreviewOptions = (encoded: string | null): PlainObject | null => {
  if (!encoded) {
    return null;
  }

  const decoded = decodeBase64(encoded);
  if (!decoded) {
    return null;
  }

  try {
    const parsed = JSON.parse(decoded);
    if (isPlainObject(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn('Unable to parse previewOptions payload', error);
  }

  return null;
};

export const sanitizePreviewOptions = (options: PlainObject | null): PlainObject | null => {
  if (!options) {
    return null;
  }

  const clone = mergeInto({}, options);

  const templateColor = clone.templateColor;
  if (isPlainObject(templateColor)) {
    const colorKeys: Array<'primaryColor' | 'secondaryColor' | 'primaryBackground' | 'secondaryBackground'> = [
      'primaryColor',
      'secondaryColor',
      'primaryBackground',
      'secondaryBackground',
    ];

    const sanitizedEntries = colorKeys
      .map((key) => {
        const css = toCssColor((templateColor as PlainObject)[key]);
        return css ? [key, css] : null;
      })
      .filter((entry): entry is [string, string] => Array.isArray(entry));

    if (sanitizedEntries.length > 0) {
      clone.templateColor = {
        ...templateColor,
        ...Object.fromEntries(sanitizedEntries),
      };
    }
  }

  const assetKeys: Array<'letterHead' | 'letterHeadFooter' | 'logo'> = [
    'letterHead',
    'letterHeadFooter',
    'logo',
  ];

  assetKeys.forEach((key) => {
    const rawValue = (clone as PlainObject)[key];
    let sanitized = toNonEmptyString(rawValue);

    if (!sanitized && isPlainObject(rawValue)) {
      sanitized = toNonEmptyString((rawValue as PlainObject).url);
    }

    if (sanitized) {
      (clone as PlainObject)[key] = sanitized;
    } else {
      delete (clone as PlainObject)[key];
    }
  });

  return clone;
};

export const applyPreviewStyles = (options: PlainObject | null | undefined) => {
  if (!options || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  if (!root) {
    return;
  }

  const setVar = (name: string, value: string | null | undefined) => {
    if (!value) {
      return;
    }
    root.style.setProperty(name, value);
  };

  const setColorVar = (name: string, value: unknown) => {
    const cssValue = toCssColor(value);
    if (!cssValue) {
      return;
    }
    setVar(name, cssValue);
  };

  const templateColor = isPlainObject(options.templateColor)
    ? (options.templateColor as PlainObject)
    : null;

  if (templateColor) {
    setColorVar('--primary-color', templateColor.primaryColor);
    setColorVar('--secondary-color', templateColor.secondaryColor);
    setColorVar('--primary-background', templateColor.primaryBackground);
    setColorVar('--secondary-background', templateColor.secondaryBackground);
  }

  const template = (options.template ?? null) as
    | {
        titleFont?: string;
        bodyFont?: string;
      }
    | null;

  if (template) {
    const titleFont = normalizeFontName(template.titleFont);
    const bodyFont = normalizeFontName(template.bodyFont);

    if (titleFont) {
      ensureGoogleFontLoaded(titleFont);
      const escaped = titleFont.replace(/'/g, "\\'");
      setVar('--title-font', `'${escaped}', sans-serif`);
    }

    if (bodyFont) {
      ensureGoogleFontLoaded(bodyFont);
      const escaped = bodyFont.replace(/'/g, "\\'");
      setVar('--subtitle-font', `'${escaped}', sans-serif`);
    }

    if (!titleFont && bodyFont) {
      const escaped = bodyFont.replace(/'/g, "\\'");
      setVar('--title-font', `'${escaped}', sans-serif`);
    }
  }
};

export const extractTemplateStyleOptions = (payload: unknown): PlainObject | null => {
  if (!isPlainObject(payload)) {
    return null;
  }

  const template = isPlainObject(payload.template) ? (payload.template as PlainObject) : null;
  if (!template) {
    return null;
  }

  const colorKeys: Array<'primaryColor' | 'secondaryColor' | 'primaryBackground' | 'secondaryBackground'> = [
    'primaryColor',
    'secondaryColor',
    'primaryBackground',
    'secondaryBackground',
  ];

  const templateColorSource = isPlainObject(template.templateColor)
    ? (template.templateColor as PlainObject)
    : null;

  const templateColor: PlainObject = {};
  colorKeys.forEach((key) => {
    if (templateColorSource && key in templateColorSource) {
      templateColor[key] = templateColorSource[key];
      return;
    }

    if (key in template) {
      templateColor[key] = template[key];
    }
  });

  const templateFonts: PlainObject = {};
  if ('titleFont' in template) {
    templateFonts.titleFont = template.titleFont;
  }
  if ('bodyFont' in template) {
    templateFonts.bodyFont = template.bodyFont;
  }

  const result: PlainObject = {};
  if (Object.keys(templateColor).length > 0) {
    result.templateColor = templateColor;
  }

  if (Object.keys(templateFonts).length > 0) {
    result.template = templateFonts;
  }

  return Object.keys(result).length > 0 ? result : null;
};

export type PreviewOptions = PlainObject | null;
