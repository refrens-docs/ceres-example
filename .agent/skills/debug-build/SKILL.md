---
name: debug-build
description: Diagnose and fix Ceres build failures
---

# Debug Build Failures

## Quick diagnosis

First, figure out what kind of build you are running:

| What you ran | What it builds |
|-------------|---------------|
| `npm run build` | Everything (renderer, all templates, all widgets) |
| `npm run build:template --template=NAME` | Just one template |
| `npm run build:widget --widget=NAME` | Just one widget |
| `npm run build:main` | Just the main renderer |

## Common errors and fixes

### "Module not found: Error: Can't resolve './template.hbs'"

Your template folder is missing a `template.hbs` file, or the filename does not match the import in `index.ts`.

**Fix**: Check that the file exists and the import path is correct:
```typescript
// In index.ts - make sure this path matches your actual file
import template from "./template.hbs";
```

### "Entry module not found"

Webpack could not find the `index.ts` file for a template or widget.

**Fix**: Make sure the folder has an `index.ts` file (not `index.js`, not `Index.ts`). The build system scans for exactly `index.ts`.

### CSS not showing up in the output

MiniCssExtractPlugin might be failing silently.

**Fix**: Check that:
1. You are importing the CSS in your `index.ts`: `import "./styles.css";`
2. The CSS file exists at that path
3. There are no syntax errors in your CSS

### Version bumping unexpectedly

The build computes a digest (hash) of your template folder. If any file changes, the version bumps.

Things that cause unexpected bumps:
- IDE-generated files (`.swp`, `.DS_Store`) in the template folder
- Trailing whitespace changes
- Line ending changes (CRLF vs LF)

**Fix**: Check `version.json` before and after. The `digest` field tells you whether the source actually changed:
```bash
git diff src/templates/my-template/version.json
```

### Manifest not updating after deploy

JSON files are set to no-cache on the CDN, but if you are testing locally, your browser might cache them.

**Fix**: Hard refresh (Ctrl+Shift+R) or open DevTools and check "Disable cache".

## Build isolation

If you only changed one template, you do not need to build everything. Use environment flags:

```bash
# Build just one template (fastest)
npm run build:template --template=my-cool-invoice

# Or set the env variable directly
TEMPLATE=my-cool-invoice npm run build

# Build only templates (skip renderer and widgets)
BUILD_TEMPLATES_ONLY=1 npm run build

# Build only widgets
BUILD_WIDGETS_ONLY=1 npm run build

# Build only the main renderer
BUILD_MAIN_ONLY=1 npm run build
```

## Checking the output

After a build, verify your template output exists:

```bash
# Check that the manifest was created
cat dist/templates/my-cool-invoice/manifest.json

# Check that the versioned bundle exists
ls dist/templates/my-cool-invoice/$(cat dist/templates/my-cool-invoice/manifest.json | jq -r '.version')/
```

You should see `bundle.js`, `bundle.css`, and `manifest.json` in the version folder.

## TypeScript errors

If you get type errors, run the type checker separately:

```bash
npm run typecheck
```

Common type issues:
- Missing `@ts-ignore` above the `.hbs` import (TypeScript does not understand Handlebars files natively)
- Using `window.CeresTemplate` without the global declaration (this is defined in `src/global.d.ts`)

## Key files to check

| File | What to look at |
|------|----------------|
| `webpack.config.js` | Entry point discovery, loader config, plugin setup |
| `src/global.d.ts` | TypeScript declarations for `.hbs` and `.css` imports |
| `package.json` | npm scripts and their underlying commands |
