/*
 * Which tax rows and tax columns a document shows.
 *
 * This is the single answer to that question. Before REF-25603 there were two, both in
 * invoiceTemplateNormalization.ts and disagreeing:
 *
 *   - the item-table column gate keyed off `taxType` + `invoiceType`
 *   - `mapped.visibility.showIgst` / `showCgstSgst` keyed off `taxName`, with no
 *     `invoiceType` term at all
 *
 * The second one is why the shipped fork's item table rendered CGST and SGST columns on a
 * quotation and on a Bill of Supply — documents that carry no tax.
 *
 * The rules match refrens.com's shared totals component
 * (lydia/src/components/widgets/invoice/balance.js), which is the behaviour customers
 * already see on 14 templates:
 *
 *   - Tax rows exist only on a tax document (`invoiceType === "INVOICE"`).
 *   - A CGST + SGST split happens only on a domestic Indian *GST* sale: the document is
 *     not inter-state, `taxType === "INDIA"`, and `taxName` is GST. Everything else —
 *     inter-state, a non-India tax type, or an Indian document whose tax is VAT/SST/
 *     anything but GST — shows the single combined row instead. That last term is what
 *     `getAggregateTaxTotals(items, key, igstTax || taxName !== 'GST')` encodes on
 *     refrens.com (lydia/src/helpers/taxAggregateSummary.js); without it a VAT invoice
 *     prints CGST and SGST rows, which is what QA reported on REF-25603.
 *   - `hideTaxes` suppresses the rows.
 *   - An export without payment of tax (`supplyType === "EXPWOP"`) suppresses a tax row
 *     whose figure is also zero. A non-zero figure still renders — this is the only place
 *     an amount participates in the decision.
 *
 * The inter-state flag is `invoice.igst`, a boolean, NOT `invoice.isIgst`. Nothing writes
 * `isIgst` onto a document: lydia sets `igst: !!totalIgst`
 * (src/helpers/getInvoiceDataFromEntry.js), serana projects `igst`
 * (src/lib/app-invoice-response.js) and both balance.js and serana's report class rename it
 * locally (`igst: igstTax`, `igst: isIgst`). Reading `isIgst` meant the flag was always
 * undefined, so every inter-state invoice rendered a zero CGST and a zero SGST row and
 * dropped its IGST row entirely. `isIgst` stays as a fallback only for a host that was
 * built against the older ceres contract.
 *
 * Note what is deliberately absent: the row is NOT gated on the figure being non-zero. A
 * domestic tax invoice with a genuine zero CGST shows a zero CGST row, because the reader
 * needs to see that the tax was considered and came to nothing.
 *
 * Lives under widgets/shared because that is where cross-bundle logic already lives
 * (formatCurrency, amountInWords). Imported by both src/main and the subtotal widget, which
 * are separate webpack bundles.
 */

import { asFlag, asText, toAmount } from "./payloadValues";

export interface TaxVisibilityInput {
  invoiceType?: unknown;
  taxType?: unknown;
  /* The document's inter-state flag — `invoice.igst`, with `invoice.isIgst` as fallback. */
  isInterState?: unknown;
  taxName?: unknown;
  supplyType?: unknown;
  hideTaxes?: unknown;
  /* Amounts off `finalTotal`, used only by the export-without-payment suppression. */
  cgst?: unknown;
  sgst?: unknown;
  igst?: unknown;
}

export interface TaxVisibilityOptions {
  /*
   * Off for the item-table columns, on for the totals rows. The column headers are a
   * property of the document's shape, so they stay put when a user toggles "hide taxes" or
   * when an export document happens to carry no tax; the totals rows are the thing those
   * two settings are about.
   */
  applySuppressions?: boolean;
}

export interface TaxVisibility {
  isTaxDocument: boolean;
  /* A domestic Indian GST sale — the only shape that splits its tax into CGST + SGST. */
  isSplitTaxSale: boolean;
  showCgstSgst: boolean;
  showIgst: boolean;
}

export const resolveTaxVisibility = (
  input: TaxVisibilityInput,
  options: TaxVisibilityOptions = {}
): TaxVisibility => {
  const isTaxDocument = asText(input.invoiceType) === "INVOICE";
  /* Absent taxName means GST, matching balance.js's `taxName = 'GST'` default. */
  const taxName = asText(input.taxName) || "GST";
  const isSplitTaxSale =
    !asFlag(input.isInterState) &&
    asText(input.taxType) === "INDIA" &&
    taxName === "GST";

  if (!isTaxDocument) {
    return {
      isTaxDocument,
      isSplitTaxSale,
      showCgstSgst: false,
      showIgst: false,
    };
  }

  if (!options.applySuppressions) {
    return {
      isTaxDocument,
      isSplitTaxSale,
      showCgstSgst: isSplitTaxSale,
      showIgst: !isSplitTaxSale,
    };
  }

  if (asFlag(input.hideTaxes)) {
    return {
      isTaxDocument,
      isSplitTaxSale,
      showCgstSgst: false,
      showIgst: false,
    };
  }

  const isExportWithoutPayment = asText(input.supplyType) === "EXPWOP";

  if (isSplitTaxSale) {
    const emptyExport =
      isExportWithoutPayment && !toAmount(input.cgst) && !toAmount(input.sgst);
    return {
      isTaxDocument,
      isSplitTaxSale,
      showCgstSgst: !emptyExport,
      showIgst: false,
    };
  }

  const emptyExport = isExportWithoutPayment && !toAmount(input.igst);
  return {
    isTaxDocument,
    isSplitTaxSale,
    showCgstSgst: false,
    showIgst: !emptyExport,
  };
};

export default resolveTaxVisibility;
