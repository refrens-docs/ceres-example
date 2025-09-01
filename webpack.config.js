const path = require("path");
const fs = require("fs");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

// Env switches
const ONLY_SYSTEM = process.env.BUILD_SYSTEM_ONLY === "1";
const ONLY_TEMPLATES = process.env.BUILD_TEMPLATES_ONLY === "1";
const ONLY_TEMPLATE = process.env.TEMPLATE; // npm run build:template --template=invoice

// Discover template entry points
function getTemplateEntries() {
  const base = path.join(__dirname, "src/templates");
  if (!fs.existsSync(base)) return {};
  const dirs = fs.readdirSync(base).filter(d => fs.statSync(path.join(base, d)).isDirectory());
  const filtered = ONLY_TEMPLATE ? dirs.filter(d => d === ONLY_TEMPLATE) : dirs;

  return filtered.reduce((acc, dir) => {
    const entry = path.join(base, dir, "index.ts");
    if (fs.existsSync(entry)) {
      acc[`templates/${dir}/bundle`] = entry;
    }
    return acc;
  }, {});
}

const templateEntries = ONLY_SYSTEM ? {} : getTemplateEntries();

const systemEntries = ONLY_TEMPLATES ? {} : {
  "main-renderer/renderer": "./src/main/index.ts",
  "widgets/index": "./src/widgets/index.ts"
};

// Final entries
const entries = Object.assign({}, systemEntries, templateEntries);

// Generate a hash based on current timestamp for cache busting
const buildHash = Date.now().toString(36); // Base36 for shorter hash

// Simple plugin to generate asset manifest
class AssetManifestPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync('AssetManifestPlugin', (compilation, callback) => {
      const manifest = {};
      
      // Map entry names to their hashed filenames
      Object.keys(compilation.assets).forEach(filename => {
        const match = filename.match(/^(.+)\.([a-z0-9]+)\.(js|css)$/);
        if (match) {
          const [, entryName, hash, extension] = match;
          if (!manifest[entryName]) manifest[entryName] = {};
          manifest[entryName][extension] = filename;
        }
      });

      // Generate manifest based on build type
      const manifestName = ONLY_SYSTEM ? 'system-manifest.json' : 'template-manifest.json';
      const manifestContent = JSON.stringify(manifest, null, 2);
      compilation.assets[manifestName] = {
        source: () => manifestContent,
        size: () => manifestContent.length
      };
      
      callback();
    });
  }
}

module.exports = {
  mode: "production",
  entry: entries,
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: `[name].${buildHash}.js`,
    iife: true,            // smaller, self-invoking bundles
    clean: false           // Don't auto-clean; use npm run clean when needed
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: "babel-loader"
          }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"]
      },
      {
        test: /\.hbs$/,
        loader: "handlebars-loader",
        options: {
          // Precompile with runtime import; keep runtime external for lean bundles
          runtime: "handlebars/runtime",
          precompileOptions: {
            knownHelpersOnly: false
          }
        }
      }
    ]
  },
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {} // avoid polyfilling Node builtins
  },
  externals: {
    "handlebars": "Handlebars",
    "handlebars/runtime": "Handlebars"
  },
  plugins: [
    new MiniCssExtractPlugin({ filename: `[name].${buildHash}.css` }),
    new ForkTsCheckerWebpackPlugin(),
    new AssetManifestPlugin()
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
      new CssMinimizerPlugin()
    ]
  },
  devtool: false
};
