# Subtotal widget

The totals block. **A template must not write totals markup or totals helpers** — that is the
whole point of this widget existing.

Before it, every template hand-wrote the block and each copy was wrong differently: a currency
symbol pasted onto a raw number, the optional `totals` object read instead of the required
`finalTotal`, tax rows that vanished when the figure was zero, two round-off rows that
refrens.com prints for nobody, and eight rows against a reference that renders thirty-three.

## Use it

```hbs
{{> Subtotal (computeSubtotalRows this
                columns=columns
                businessCurrency=businessCurrency
                businessLocale=businessLocale) }}
```

and register the bundle from your template's `index.ts`:

```ts
import "../../widgets/subtotal";
```

### The first argument depends on your data mapper

A template's root context is whatever `window.CeresTemplateDataMapper` returns, and both
shapes are live:

| Your template | First argument | Columns |
|---|---|---|
| sets no mapper (flat payload at the root) | `this` | `columns=columns` |
| assigns `normalizeInvoiceTemplateState` | `invoice` | `columns=mapped.columns` |

Passing the wrong one renders a totals block with no rows. The helper also accepts the wrapped
`{ invoice, ... }` payload, so it resolves all three shapes — but pass the invoice explicitly
rather than relying on that.

### Hash arguments

All optional. Everything falls back to a field on the invoice, which is what makes the widget
work inside the iframe as well as in Lydia's in-app render.

| Argument | Falls back to | Why it matters |
|---|---|---|
| `columns` | `invoice.columns` | Row labels come from the document's own column settings, so a business that renamed Discount to Rebate sees it here too |
| `businessCurrency` | `invoice.owner.currency` | **The fallback is load-bearing.** `businessCurrency` is a Lydia client-side prop that never reaches the iframe, which fetches the serana document directly. Without the fallback the converted-amount sub-line silently never renders |
| `businessLocale` | `invoice.owner.locale` | Formats the converted amount |
| `ownerConfiguration` | `invoice.owner.configuration` | Carries `experimental.hideCurrencyCode` |

## Styling

The widget ships structure only — the two-column alignment and the sub-line treatment. Colour,
type and spacing are yours: target the widget's classes from your template's `styles.css`.
`src/templates/basic-invoice-example/styles.css` is a worked example (a gradient panel with a
gold grand total).

| Class | Element |
|---|---|
| `.ceres-subtotal` | the whole block |
| `.ceres-subtotal-table` | one of up to three tables: main, `-extra`, `-due` |
| `.ceres-subtotal-row` | a row; `-grand` on the Total, `-due` on the Due Amount |
| `.ceres-subtotal-label` / `-value` | the two columns |
| `.ceres-subtotal-note` | the tax rate under a taxed additional charge |
| `.ceres-subtotal-converted` | the converted amount on a foreign-currency document |
| `.ceres-subtotal-words` / `-words-label` / `-words-value` | the amount-in-words line |

## Do not remove the data attributes

Every row stays in the DOM and the hide settings are pure visibility flips, because that is how
the Lydia host toggles them live. If you copy the partial and drop an attribute, its setting
stops working with no error:

| Attribute | Toggled by |
|---|---|
| `data-ceres-subtotal` | the block |
| `data-ceres-subtotal-row="<key>"` | one row, carrying its model key |
| `data-ceres-subtotal-taxes` | `hideTaxes` |
| `data-ceres-subtotal-keep` | survives `hideTotals` (additional charges) |
| `data-ceres-total-in-words` | `hideTotalInWords` |

Handlers live in `src/main/commonUtils.ts` (`applyHideTotalsUpdate`, `applyHideTaxesUpdate`,
`applyHideTotalInWordsUpdate`) and are registered in `src/main/lydiaBridge.ts`.

## What it decides for you

- **Row set and order** mirror `lydia/src/components/widgets/invoice/balance.js`, the component
  all 14 refrens.com templates share. Rows 1-33 of it; the early-pay table is absent because it
  hangs off a host prop with no document field behind it.
- **Amounts** all go through one currency helper. Negatives print as `(₹1,234.50)`.
- **Labels** resolve `customLabels` → the document's column label → an English constant.
- **Tax rows** are decided by the document — type, tax type, interstate, export-without-payment,
  `hideTaxes` — never by whether the figure is zero. A domestic invoice with a genuine zero CGST
  shows a zero CGST row, deliberately.
- **No round-off rows**, ever. Rounding is already inside `total`.
- **`finalTotal`**, never the optional `totals`.
- **The converted amount** is applied to every currency row on a foreign-currency document.

## Extending it

Add rows in `utils.ts`, not in a template. Put the predicate there too — `index.ts` is excluded
from coverage precisely so that nothing which can be got wrong lives in it. Tests:
`tests/subtotal.test.ts` for the model, `tests/subtotalLiveUpdate.test.ts` for the rendered DOM
and the host handlers.
