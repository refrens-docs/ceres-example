const path = require("path");
const fs = require("fs");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const { RawSource } = require("webpack").sources;

// Env switches (simplified)
// Removed BUILD_SYSTEM_ONLY legacy flag
const ONLY_TEMPLATES = process.env.BUILD_TEMPLATES_ONLY === "1"; // build only templates
const ONLY_MAIN = process.env.BUILD_MAIN_ONLY === "1"; // build just main renderer
const ONLY_WIDGETS = process.env.BUILD_WIDGETS_ONLY === "1"; // build just widgets
const ONLY_TEMPLATE = process.env.TEMPLATE; // npm run build:template --template=<name>
const ONLY_WIDGET = process.env.WIDGET; // npm run build:widget --widget=<name>
const PURGE_OLD = process.env.PURGE_OLD_ASSETS === "1"; // optional cleanup flag

// --- Template SemVer Helpers (enhanced) ----------------------------------------------
function isValidTemplateName(name) {
  return /^[a-z0-9-]+$/i.test(name);
}
function safeReadJSON(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return null;
  }
}
function readVersionFile(filePath) {
  const data = safeReadJSON(filePath);
  if (!data || typeof data.version !== "string") return null;
  return /^\d+\.\d+\.\d+$/.test(data.version) ? data.version : null;
}
function writeVersionFile(filePath, version) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ version }, null, 2));
  } catch (e) {
    // Non-fatal: build continues; version will still be used in-memory
  }
}
function bumpPatchVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v || "");
  if (!m) return "1.0.1"; // initialize sequence if corrupt
  return `${m[1]}.${m[2]}.${parseInt(m[3], 10) + 1}`;
}
function ensureAndMaybeInit(templateName) {
  const versionFile = path.join(
    __dirname,
    "src",
    "templates",
    templateName,
    "version.json",
  );
  let current = readVersionFile(versionFile);
  if (!current) {
    current = "1.0.0";
    writeVersionFile(versionFile, current);
  }
  return { versionFile, current };
}
function bumpTemplate(templateName) {
  const meta = ensureAndMaybeInit(templateName);
  const next = bumpPatchVersion(meta.current);
  writeVersionFile(meta.versionFile, next);
  return next;
}
function computeTemplateVersionMap(templateEntryNames) {
  const map = {};
  templateEntryNames.forEach((entryKey) => {
    // entryKey pattern: templates/<name>/bundle
    if (!entryKey.startsWith("templates/")) return;
    const parts = entryKey.split("/");
    if (parts.length < 3) return;
    const templateName = parts[1];
    if (!isValidTemplateName(templateName)) return;
    if (map[templateName]) return; // guard duplicate
    map[templateName] = bumpTemplate(templateName);
  });
  return map;
}
let templateVersionMap = {}; // populated only if templates are built
// --------------------------------------------------------------------------------------

// --- Widget SemVer Helpers (new) -----------------------------------------------------
function ensureAndMaybeInitWidget(widgetName) {
  const versionFile = path.join(
    __dirname,
    "src",
    "widgets",
    widgetName,
    "version.json",
  );
  let current = readVersionFile(versionFile);
  if (!current) {
    current = "1.0.0";
    writeVersionFile(versionFile, current);
  }
  return { versionFile, current };
}
function bumpWidget(widgetName) {
  const meta = ensureAndMaybeInitWidget(widgetName);
  const next = bumpPatchVersion(meta.current);
  writeVersionFile(meta.versionFile, next);
  return next;
}
function computeWidgetVersionMap(widgetEntryNames) {
  const map = {};
  widgetEntryNames.forEach((entryKey) => {
    // entryKey pattern: widgets/<name>/bundle
    if (!entryKey.startsWith("widgets/")) return;
    const parts = entryKey.split("/");
    if (parts.length < 3) return;
    const widgetName = parts[1];
    if (!isValidTemplateName(widgetName)) return;
    if (map[widgetName]) return; // guard duplicate
    map[widgetName] = bumpWidget(widgetName);
  });
  return map;
}
let widgetVersionMap = {}; // populated only if widgets are built
// --------------------------------------------------------------------------------------

// Discover template entry points
function getTemplateEntries() {
  const base = path.join(__dirname, "src/templates");
  if (!fs.existsSync(base)) return {};
  const dirs = fs
    .readdirSync(base)
    .filter((d) => fs.statSync(path.join(base, d)).isDirectory());
  const filtered = ONLY_TEMPLATE
    ? dirs.filter((d) => d === ONLY_TEMPLATE)
    : dirs;
  return filtered.reduce((acc, dir) => {
    const entry = path.join(base, dir, "index.ts");
    if (fs.existsSync(entry)) acc[`templates/${dir}/bundle`] = entry;
    return acc;
  }, {});
}

// Discover widget entry points (per widget)
function getWidgetEntries() {
  const base = path.join(__dirname, "src/widgets");
  if (!fs.existsSync(base)) return {};
  const dirs = fs
    .readdirSync(base)
    .filter((d) => fs.statSync(path.join(base, d)).isDirectory());
  const filtered = ONLY_WIDGET ? dirs.filter((d) => d === ONLY_WIDGET) : dirs;
  return filtered.reduce((acc, dir) => {
    const entry = path.join(base, dir, "index.ts");
    if (fs.existsSync(entry)) acc[`widgets/${dir}/bundle`] = entry;
    return acc;
  }, {});
}

// Decide entries
let templateEntries = {};
if (ONLY_TEMPLATES || ONLY_TEMPLATE) templateEntries = getTemplateEntries();
else if (ONLY_MAIN || ONLY_WIDGETS) templateEntries = {};
else templateEntries = getTemplateEntries();

let widgetEntries = {};
if (ONLY_WIDGETS) widgetEntries = getWidgetEntries();
else if (ONLY_MAIN || ONLY_TEMPLATES || ONLY_TEMPLATE) widgetEntries = {};
else widgetEntries = getWidgetEntries();

let systemEntries = {};
if (ONLY_TEMPLATES || ONLY_TEMPLATE) systemEntries = {};
else if (ONLY_MAIN)
  systemEntries = { "main-renderer/renderer": "./src/main/index.ts" };
else if (ONLY_WIDGETS)
  systemEntries = {}; // no aggregate widgets index; build per-widget bundles
else
  systemEntries = {
    "main-renderer/renderer": "./src/main/index.ts",
  };

const entries = { ...systemEntries, ...templateEntries, ...widgetEntries };

// Build version maps ONCE (patch bump) only if we are actually building assets
const templateEntryKeys = Object.keys(templateEntries);
if (templateEntryKeys.length) {
  templateVersionMap = computeTemplateVersionMap(templateEntryKeys);
}
const widgetEntryKeys = Object.keys(widgetEntries);
if (widgetEntryKeys.length) {
  widgetVersionMap = computeWidgetVersionMap(widgetEntryKeys);
}

// Simple plugin to generate asset manifest
class AssetManifestPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap("AssetManifestPlugin", (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: "AssetManifestPlugin",
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        () => {
          const MAIN_ENTRY = "main-renderer/renderer";
          const templateManifests = {}; // tplName -> { js, css }
          const widgetManifests = {}; // widgetName -> { js, css }

          for (const [entryName, entrypoint] of compilation.entrypoints) {
            const files = entrypoint
              .getFiles()
              .filter((f) => /\.(js|css)$/.test(f));
            if (!files.length) continue;
            const assetRecord = {};
            for (const file of files) {
              if (file.endsWith(".js") && !assetRecord.js)
                assetRecord.js = file;
              if (file.endsWith(".css") && !assetRecord.css)
                assetRecord.css = file;
            }
            if (entryName === MAIN_ENTRY) {
              // Emit flat main manifest
              compilation.emitAsset(
                "main-manifest.json",
                new RawSource(JSON.stringify(assetRecord, null, 2)),
              );
              continue;
            }
            if (entryName.startsWith("templates/")) {
              const parts = entryName.split("/");
              if (parts.length >= 3) {
                const templateName = parts[1];
                templateManifests[templateName] = assetRecord;
              }
              continue;
            }
            if (entryName.startsWith("widgets/")) {
              const parts = entryName.split("/");
              if (parts.length >= 3) {
                const widgetName = parts[1];
                widgetManifests[widgetName] = assetRecord;
              }
              continue;
            }
          }

          const emitJSON = (name, obj) =>
            compilation.emitAsset(
              name,
              new RawSource(JSON.stringify(obj, null, 2)),
            );

          // Template manifests with version + assets wrapper
          for (const [tpl, rec] of Object.entries(templateManifests)) {
            const version = templateVersionMap[tpl] || null;
            emitJSON(`templates/${tpl}/manifest.json`, {
              version,
              assets: { [`templates/${tpl}/bundle`]: rec },
            });
          }

          // Widgets: per-widget manifest (with version) and a summary manifest mapping
          const widgetsSummary = {};
          for (const [w, rec] of Object.entries(widgetManifests)) {
            const version = widgetVersionMap[w] || null;
            emitJSON(`widgets/${w}/manifest.json`, {
              version,
              assets: { [`widgets/${w}/bundle`]: rec },
            });
            widgetsSummary[w] = { ...rec, version };
          }
          if (Object.keys(widgetsSummary).length) {
            emitJSON("widgets-manifest.json", widgetsSummary);
          }

          // Optional purge of old template and widget versions
          if (PURGE_OLD && (Object.keys(templateVersionMap).length || Object.keys(widgetVersionMap).length)) {
            const distRoot = compiler.options.output.path;
            const DEBUG = process.env.PURGE_OLD_DEBUG === "1";

            // Purge templates
            for (const tpl of Object.keys(templateVersionMap)) {
              const currentVersion = templateVersionMap[tpl];
              const dir = path.join(distRoot, "templates", tpl);
              if (!fs.existsSync(dir)) continue;
              try {
                const anyPattern = /^bundle\.([^.]+\.[^.]+\.[^.]+|[^.]+)\.(js|css)$/;
                for (const f of fs.readdirSync(dir)) {
                  const m = anyPattern.exec(f);
                  if (!m) continue;
                  const token = m[1];
                  const isSemVer = /^\d+\.\d+\.\d+$/.test(token);
                  const keep = isSemVer ? token === currentVersion : false;
                  if (keep) { if (DEBUG) console.log("[purge] keep tpl", tpl, f); continue; }
                  const abs = path.join(dir, f);
                  try {
                    const relAssetKey = path.relative(distRoot, abs).split(path.sep).join("/");
                    if (compilation.getAsset(relAssetKey)) compilation.deleteAsset(relAssetKey);
                    fs.unlinkSync(abs);
                    if (DEBUG) console.log("[purge] removed old tpl", tpl, f);
                  } catch (err) {
                    if (DEBUG) console.warn("[purge] failed remove tpl", f, err && err.message);
                  }
                }
              } catch (e) {
                if (DEBUG) console.warn("[purge] error scanning tpl", tpl, e && e.message);
              }
            }

            // Purge widgets
            for (const w of Object.keys(widgetVersionMap)) {
              const currentVersion = widgetVersionMap[w];
              const dir = path.join(distRoot, "widgets", w);
              if (!fs.existsSync(dir)) continue;
              try {
                const anyPattern = /^bundle\.([^.]+\.[^.]+\.[^.]+|[^.]+)\.(js|css)$/;
                for (const f of fs.readdirSync(dir)) {
                  const m = anyPattern.exec(f);
                  if (!m) continue;
                  const token = m[1];
                  const isSemVer = /^\d+\.\d+\.\d+$/.test(token);
                  const keep = isSemVer ? token === currentVersion : false;
                  if (keep) { if (DEBUG) console.log("[purge] keep widget", w, f); continue; }
                  const abs = path.join(dir, f);
                  try {
                    const relAssetKey = path.relative(distRoot, abs).split(path.sep).join("/");
                    if (compilation.getAsset(relAssetKey)) compilation.deleteAsset(relAssetKey);
                    fs.unlinkSync(abs);
                    if (DEBUG) console.log("[purge] removed old widget", w, f);
                  } catch (err) {
                    if (DEBUG) console.warn("[purge] failed remove widget", f, err && err.message);
                  }
                }
              } catch (e) {
                if (DEBUG) console.warn("[purge] error scanning widget", w, e && e.message);
              }
            }
          }
        },
      );
    });
  }
}

// Build dynamic partialDirs for all widgets subfolders
function getWidgetPartialDirs() {
  const base = path.join(__dirname, "src", "widgets");
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base)
    .filter((d) => fs.statSync(path.join(base, d)).isDirectory())
    .map((d) => path.resolve(__dirname, "src/widgets", d));
}

module.exports = {
  mode: "production",
  entry: entries,
  output: {
    path: path.resolve(__dirname, "dist"),
    // Dynamic filename: templates use semver; widgets & system bundles use contenthash for cache busting
    filename: (pathData) => {
      const name =
        pathData.chunk && pathData.chunk.name ? pathData.chunk.name : "[name]";
      if (name.startsWith("templates/")) {
        const parts = name.split("/");
        const tpl = parts[1];
        const version = templateVersionMap[tpl];
        return `${name}.${version}.js`;
      }
      if (name.startsWith("widgets/")) {
        const parts = name.split("/");
        const w = parts[1];
        const version = widgetVersionMap[w];
        return `${name}.${version}.js`;
      }
      return `${name}.[contenthash:8].js`;
    },
    iife: true,
    clean: false,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [{ loader: "babel-loader" }],
        exclude: /node_modules/,
      },
      { test: /\.css$/, use: [MiniCssExtractPlugin.loader, "css-loader"] },
      {
        test: /\.hbs$/,
        loader: "handlebars-loader",
        options: {
          runtime: "handlebars/runtime",
          precompileOptions: { knownHelpersOnly: false },
          partialDirs: getWidgetPartialDirs(),
        },
      },
    ],
  },
  resolve: { extensions: [".ts", ".js"], fallback: {} },
  externals: { handlebars: "Handlebars", "handlebars/runtime": "Handlebars" },
  plugins: [
    new MiniCssExtractPlugin({
      filename: (pathData) => {
        const name =
          pathData.chunk && pathData.chunk.name
            ? pathData.chunk.name
            : "[name]";
        if (name.startsWith("templates/")) {
          const parts = name.split("/");
          const tpl = parts[1];
          const version = templateVersionMap[tpl];
          return `${name}.${version}.css`;
        }
        if (name.startsWith("widgets/")) {
          const parts = name.split("/");
          const w = parts[1];
          const version = widgetVersionMap[w];
          return `${name}.${version}.css`;
        }
        return `${name}.[contenthash:8].css`;
      },
    }),
    new ForkTsCheckerWebpackPlugin(),
    new AssetManifestPlugin(),
  ],
  optimization: {
    usedExports: true,
    sideEffects: true,
    concatenateModules: true,
    splitChunks: false,
    runtimeChunk: false,
    minimize: true,
    minimizer: ["...", new CssMinimizerPlugin()],
  },
  devtool: false,
};
