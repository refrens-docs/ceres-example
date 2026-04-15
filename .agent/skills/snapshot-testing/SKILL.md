---
name: snapshot-testing
description: Manage visual regression tests for Ceres templates
---

# Snapshot Testing

## What snapshots do

Snapshots catch visual regressions. They take a screenshot of a rendered template and compare it to a saved baseline. If the screenshots differ, the test fails and shows you a diff.

## How it works

1. Each template has a `samples.json` file with named live API URLs (base64-encoded)
2. The test runner (Playwright) starts a local server with the built Ceres files
3. For each template and each sample URL, it opens the page and waits for rendering to finish
4. It takes a full-page screenshot and compares it to the saved baseline in `__snapshots__/`

## Running tests

```bash
# Run all snapshot tests (compares against baselines)
npm run test:snapshots

# Update baselines (saves new screenshots as the baselines)
npm run test:snapshots:update
```

## Adding a new test sample

Open your template's `samples.json` and add a new named entry:

```json
{
  "simple-invoice": "aHR0cHM6Ly8...",
  "invoice-with-many-items": "aHR0cHM6Ly8..."
}
```

Each key becomes a snapshot name. Use descriptive names so you know what case they test.

To base64-encode a URL:
```javascript
btoa("https://api.refrens.com/invoices/YOUR_ID?_at=YOUR_TOKEN&populateBusiness=true")
```

After adding a new sample, run `npm run test:snapshots:update` to create the initial baseline.

## When a test fails

You will see output like:

```
FAIL: basic-invoice-example/simple-invoice
  Screenshot differs from baseline.
  Expected: __snapshots__/basic-invoice-example/simple-invoice.png
  Actual:   test-results/basic-invoice-example/simple-invoice-actual.png
  Diff:     test-results/basic-invoice-example/simple-invoice-diff.png
```

Look at the diff image. Changed pixels are highlighted.

**If the change is intentional**: Run `npm run test:snapshots:update`.
**If the change is a bug**: Fix your template and run tests again.

## File structure

```
__snapshots__/           # Committed to git (baselines)
  basic-invoice-example/
    simple-invoice.png
    invoice-with-gst.png
test-results/            # NOT committed (generated on failures)
  basic-invoice-example/
    simple-invoice-actual.png
    simple-invoice-diff.png
```

## Tips

- **Always commit `__snapshots__/`**. These are your baselines.
- **Never commit `test-results/`**. This is generated on test failures.
- **Use at least 2 samples per template**: one simple case and one edge case.
- **API data can change**: If the live API data changes (someone edits the invoice), baselines may break. Update them with `npm run test:snapshots:update` after verifying the rendered output looks correct.
