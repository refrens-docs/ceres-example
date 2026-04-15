# Ceres - Custom Document Renderer

Ceres renders custom document templates (invoices, quotations) inside an iframe in Lydia. It uses Handlebars for templating and plain CSS for styling.

## Project Structure

- `src/main/` - Main renderer (loads templates, fetches API data, renders)
- `src/templates/` - Custom templates (each folder is one template)
- `src/widgets/` - Reusable Handlebars partials (InvoiceStatus, DemoBadge, DateTime, MarkdownViewer)
- `webpack.config.js` - Build config with automatic entry discovery and semver versioning

## How it works

1. Browser loads `index.html` which fetches `main-manifest.json`
2. Renderer reads `?template=<name>&apiUrl=<base64>` from the URL
3. Loads template JS/CSS bundles, template registers `window.CeresTemplate`
4. Renderer fetches API data and calls `window.CeresTemplate(data)`
5. Result HTML goes into `<div id="documentOutput">`

## Lydia Integration

Runs inside an iframe. Communication via postMessage:
- Lydia sends: `lydia:print`, `lydia:height-request`, `lydia:template-update`
- Ceres sends: `ceres:content-height`

## Skills (read .agent/skills/*/SKILL.md for detailed instructions)

- `scaffold-template` - Create a new template with all required files
- `debug-build` - Diagnose and fix build failures
- `navigate-codebase` - Understand repo structure and Lydia integration
- `snapshot-testing` - Manage visual regression tests
- `design-to-template` - Convert Figma/screenshot into a Ceres template

## Build Commands

```bash
npm run build                                    # Build everything
npm run build:template --template=my-template    # Build one template
npm run build:widget --widget=date-time          # Build one widget
npm run typecheck                                # TypeScript check
npm test                                         # Run tests
```
