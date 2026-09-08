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
 *   - A domestic Indian sale (`!isIgst && taxType === "INDIA"`) shows CGST + SGST;
 *     everything else shows IGST. There is no third state and no "neither".
 *   - `hideTaxes` suppresses the rows.
 *   - An export without payment of tax (`supplyType === "EXPWOP"`) suppresses a tax row
 *     whose figure is also zero. A non-zero figure still renders — this is the only place
 *     an amount participates in the decision.
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
  isIgst?: unknown;
  supplyType?: unknown;
  hideTaxes?: unknown;
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
  isDomesticIndia: boolean;
  showCgstSgst: boolean;
  showIgst: boolean;
}

export const resolveTaxVisibility = (
  input: TaxVisibilityInput,
  options: TaxVisibilityOptions = {}
): TaxVisibility => {
  const isTaxDocument = asText(input.invoiceType) === "INVOICE";
  const isDomesticIndia =
    !asFlag(input.isIgst) && asText(input.taxType) === "INDIA";

  if (!isTaxDocument) {
    return {
      isTaxDocument,
      isDomesticIndia,
      showCgstSgst: false,
      showIgst: false,
    };
  }

  if (!options.applySuppressions) {
    return {
      isTaxDocument,
      isDomesticIndia,
      showCgstSgst: isDomesticIndia,
      showIgst: !isDomesticIndia,
    };
  }

  if (asFlag(input.hideTaxes)) {
    return {
      isTaxDocument,
      isDomesticIndia,
      showCgstSgst: false,
      showIgst: false,
    };
  }

  const isExportWithoutPayment = asText(input.supplyType) === "EXPWOP";

  if (isDomesticIndia) {
    const emptyExport =
      isExportWithoutPayment && !toAmount(input.cgst) && !toAmount(input.sgst);
    return {
      isTaxDocument,
      isDomesticIndia,
      showCgstSgst: !emptyExport,
      showIgst: false,
    };
  }

  const emptyExport = isExportWithoutPayment && !toAmount(input.igst);
  return {
    isTaxDocument,
    isDomesticIndia,
    showCgstSgst: false,
    showIgst: !emptyExport,
  };
};

export default resolveTaxVisibility;
