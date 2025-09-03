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

// Discover template entry points
function getTemplateEntries() {
  const base = path.join(__dirname, "src/templates");
  if (!fs.existsSync(base)) return {};
  const dirs = fs
    .readdirSync(base)
    .filter((d) => fs.statSync(path.join(base, d)).isDirectory());
  const filtered = ONLY_TEMPLATE ? dirs.filter((d) => d === ONLY_TEMPLATE) : dirs;
  return filtered.reduce((acc, dir) => {
    const entry = path.join(base, dir, "index.ts");
    if (fs.existsSync(entry)) acc[`templates/${dir}/bundle`] = entry;
    return acc;
  }, {});
}

// Decide template entries
let templateEntries = {};
if (ONLY_TEMPLATES || ONLY_TEMPLATE) {
  templateEntries = getTemplateEntries();
} else if (ONLY_MAIN || ONLY_WIDGETS) {
  templateEntries = {}; // skip templates
} else {
  // full build (everything)
  templateEntries = getTemplateEntries();
}

// Decide system entries
let systemEntries = {};
if (ONLY_TEMPLATES || ONLY_TEMPLATE) {
  systemEntries = {}; // no system code
} else if (ONLY_MAIN) {
  systemEntries = { "main-renderer/renderer": "./src/main/index.ts" };
} else if (ONLY_WIDGETS) {
  systemEntries = { "widgets/index": "./src/widgets/index.ts" };
} else {
  // full build (main + widgets)
  systemEntries = {
    "main-renderer/renderer": "./src/main/index.ts",
    "widgets/index": "./src/widgets/index.ts",
  };
}

// Final entries
const entries = { ...systemEntries, ...templateEntries };

// Generate a hash based on current timestamp for cache busting
const buildHash = Date.now().toString(36); // Base36 for shorter hash

// Selective purge of older hashed assets per entry (keep caching, avoid buildup)
(function purgeOldHashedAssets() {
  const outputDir = path.resolve(__dirname, 'dist');
  if (!fs.existsSync(outputDir)) return;
  Object.keys(entries).forEach((entryName) => {
    const dirRel = path.dirname(entryName);
    const dirAbs = dirRel === '.' ? outputDir : path.join(outputDir, dirRel);
    if (!fs.existsSync(dirAbs)) return;
    const base = path.basename(entryName); // e.g. bundle
    try {
      for (const file of fs.readdirSync(dirAbs)) {
        if (!file.startsWith(base + '.')) continue; // different base
        if (!/\.(js|css)$/.test(file)) continue;
        if (file.includes(`.${buildHash}.`)) continue; // current build hash (unlikely pre-existing)
        // Remove old hashed asset
        fs.unlinkSync(path.join(dirAbs, file));
      }
    } catch (e) {
      // swallow errors to not break build
    }
  });
})();

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
          const WIDGETS_ENTRY = "widgets/index";
          let mainManifest = null;
          let widgetsManifest = null;
          const templateManifests = {};
          for (const [entryName, entrypoint] of compilation.entrypoints) {
            const files = entrypoint.getFiles().filter((f) => /\.(js|css)$/.test(f));
            if (!files.length) continue;
            const assetRecord = {};
            for (const file of files) {
              if (file.endsWith(".js") && !assetRecord.js) assetRecord.js = file;
              if (file.endsWith(".css") && !assetRecord.css) assetRecord.css = file;
            }
            if (entryName === MAIN_ENTRY) mainManifest = assetRecord;
            else if (entryName === WIDGETS_ENTRY) widgetsManifest = assetRecord;
            else if (entryName.startsWith("templates/")) {
              const parts = entryName.split("/");
              if (parts.length >= 3) {
                const templateName = parts[1];
                templateManifests[templateName] = assetRecord;
              }
            }
          }
          const emitJSON = (name, obj) => {
            compilation.emitAsset(name, new RawSource(JSON.stringify(obj, null, 2)));
          };
          if (mainManifest) emitJSON("main-manifest.json", mainManifest);
            if (widgetsManifest) emitJSON("widgets-manifest.json", widgetsManifest);
            for (const [tpl, rec] of Object.entries(templateManifests)) emitJSON(`templates/${tpl}/manifest.json`, rec);
        },
      );
    });
  }
}

module.exports = {
  mode: "production",
  entry: entries,
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: `[name].${buildHash}.js`,
    iife: true,
    clean: false,
  },
  module: {
    rules: [
      { test: /\.ts$/, use: [{ loader: "babel-loader" }], exclude: /node_modules/ },
      { test: /\.css$/, use: [MiniCssExtractPlugin.loader, "css-loader"] },
      { test: /\.hbs$/, loader: "handlebars-loader", options: { runtime: "handlebars/runtime", precompileOptions: { knownHelpersOnly: false } } },
    ],
  },
  resolve: { extensions: [".ts", ".js"], fallback: {} },
  externals: { handlebars: "Handlebars", "handlebars/runtime": "Handlebars" },
  plugins: [
    new MiniCssExtractPlugin({ filename: `[name].${buildHash}.css` }),
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
