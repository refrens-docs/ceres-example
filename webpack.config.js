const path = require("path");
const fs = require("fs");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const { RawSource } = require("webpack").sources;

// Env switches
const ONLY_SYSTEM = process.env.BUILD_SYSTEM_ONLY === "1";
const ONLY_TEMPLATES = process.env.BUILD_TEMPLATES_ONLY === "1";
const ONLY_TEMPLATE = process.env.TEMPLATE; // npm run build:template --template=invoice

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
    if (fs.existsSync(entry)) {
      acc[`templates/${dir}/bundle`] = entry;
    }
    return acc;
  }, {});
}

const templateEntries = ONLY_SYSTEM ? {} : getTemplateEntries();

const systemEntries = ONLY_TEMPLATES
  ? {}
  : {
      "main-renderer/renderer": "./src/main/index.ts",
      "widgets/index": "./src/widgets/index.ts",
    };

// Final entries
const entries = Object.assign({}, systemEntries, templateEntries);

// Generate a hash based on current timestamp for cache busting
const buildHash = Date.now().toString(36); // Base36 for shorter hash

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
          // Build maps for each manifest
          const systemManifest = {};
          const templateManifest = {};

          // Use compilation.entrypoints to reliably map entry names -> files
          for (const [entryName, entrypoint] of compilation.entrypoints) {
            // getFiles returns CSS/JS/etc emitted by this entrypoint (honors ordering)
            const files = entrypoint
              .getFiles()
              .filter((f) => /\.(js|css)$/.test(f));
            if (!files.length) continue;

            // Choose which manifest to put this entry into.
            // We assume template entries are named with 'templates/' prefix per your config.
            const target = entryName.startsWith("templates/")
              ? templateManifest
              : systemManifest;

            // Map extension -> file (if multiple JS/CSS per entry, prefer the first seen for each ext)
            target[entryName] = target[entryName] || {};
            for (const file of files) {
              if (file.endsWith(".js") && !target[entryName].js)
                target[entryName].js = file;
              if (file.endsWith(".css") && !target[entryName].css)
                target[entryName].css = file;
            }
          }

          // Emit manifests only if non-empty
          if (Object.keys(systemManifest).length) {
            const name = "system-manifest.json";
            const content = JSON.stringify(systemManifest, null, 2);
            compilation.emitAsset(name, new RawSource(content));
          }

          if (Object.keys(templateManifest).length) {
            const name = "template-manifest.json";
            const content = JSON.stringify(templateManifest, null, 2);
            compilation.emitAsset(name, new RawSource(content));
          }
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
    iife: true, // smaller, self-invoking bundles
    clean: false, // Don't auto-clean; use npm run clean when needed
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: "babel-loader",
          },
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
      {
        test: /\.hbs$/,
        loader: "handlebars-loader",
        options: {
          // Precompile with runtime import; keep runtime external for lean bundles
          runtime: "handlebars/runtime",
          precompileOptions: {
            knownHelpersOnly: false,
          },
        },
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {}, // avoid polyfilling Node builtins
  },
  externals: {
    handlebars: "Handlebars",
    "handlebars/runtime": "Handlebars",
  },
  plugins: [
    new MiniCssExtractPlugin({ filename: `[name].${buildHash}.css` }),
    new ForkTsCheckerWebpackPlugin(),
    new AssetManifestPlugin(),
  ],
  optimization: {
    usedExports: true,
    sideEffects: true,
    concatenateModules: true,
    splitChunks: false, // critical: keep bundles fully standalone for CDN/iframe
    runtimeChunk: false,
    minimize: true,
    minimizer: [
      "...", // Terser
      new CssMinimizerPlugin(),
    ],
  },
  devtool: false,
};
