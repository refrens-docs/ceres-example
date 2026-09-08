import fixture from "./fixtures/columns-basic.json";
import { normalizeInvoiceTemplateState } from "../src/main/invoiceTemplateNormalization";

// SC54 (REF-25643 phase 7) — ceres and ceres-example keep two hand-maintained
// copies of the same contract and normalization (docs/learnings/ceres/
// contract-is-two-hand-copies.md). There is no automated way to import one
// repo's code from the other's test suite — they are separate repositories
// with separate CI — so parity is proven the way a contract test proves
// compatibility with an external system: against a pinned oracle.
//
// fixtures/columns-basic.json is byte-identical to ceres's own
// e2e/fixtures/columns-basic.json (used by its "basic-invoice-example — line
// items table (SC8)" spec). The expected values below were captured by
// running ceres's normalizeInvoiceTemplateState against this exact fixture
// on this ticket's branch (re-captured at commit 9ec04da, after money
// formatting was corrected) — they are ceres's real output,
// not a guess. If either repo's normalization changes what it resolves for
// this fixture, this test or ceres's SC8 spec (or both) will catch the drift.
describe("line items contract parity with ceres (SC54)", () => {
  const state = normalizeInvoiceTemplateState(fixture as any);
  const visibleColumns = state.mapped.columns.filter(
    (column) => !column.isHidden
  );

  it("resolves the same columns, in the same order, with the same labels and hidden state as ceres", () => {
    expect(
      visibleColumns.map((column) => ({ key: column.key, label: column.label }))
    ).toEqual([
      { key: "rate", label: "Rate" },
      { key: "name", label: "Item" },
      { key: "quantity", label: "Qty" },
      { key: "amount", label: "Line Total" },
      { key: "warranty", label: "Warranty" },
    ]);

    // The business switched SKU off — it resolves as hidden, not dropped from
    // the list, matching ceres's own SC33/SC35-style column resolution.
    const skuColumn = state.mapped.columns.find(
      (column) => column.key === "sku"
    );
    expect(skuColumn?.isHidden).toBe(true);
  });

  it("resolves the same cell text as ceres for every visible column, on every row", () => {
    const rowTexts = state.mapped.rows.map((row) => ({
      cells: row.cells
        .filter((cell) =>
          visibleColumns.some((column) => column.key === cell.key)
        )
        .map((cell) => ({ key: cell.key, text: cell.text })),
      lineNumber: row.lineNumber,
      isGroupHeading: row.isGroupHeading,
      isAdditionalCharge: row.isAdditionalCharge,
    }));

    expect(rowTexts).toEqual([
      {
        cells: [
          { key: "rate", text: "" },
          { key: "name", text: "Group A" },
          { key: "quantity", text: "" },
          { key: "amount", text: "" },
          { key: "warranty", text: "" },
        ],
        lineNumber: null,
        isGroupHeading: true,
        isAdditionalCharge: false,
      },
      {
        cells: [
          { key: "rate", text: "10,000" },
          { key: "name", text: "Design Retainer" },
          { key: "quantity", text: "2" },
          { key: "amount", text: "\u20b9 20,000.00" },
          { key: "warranty", text: "12 months" },
        ],
        lineNumber: 1,
        isGroupHeading: false,
        isAdditionalCharge: false,
      },
      {
        cells: [
          { key: "rate", text: "5,000" },
          { key: "name", text: "Onboarding Service" },
          { key: "quantity", text: "1" },
          { key: "amount", text: "\u20b9 5,000.00" },
          { key: "warranty", text: "6 months" },
        ],
        lineNumber: 2,
        isGroupHeading: false,
        isAdditionalCharge: false,
      },
      {
        cells: [
          { key: "rate", text: "" },
          { key: "name", text: "Sub total" },
          { key: "quantity", text: "3.00" },
          { key: "amount", text: "\u20b9 25,000.00" },
          { key: "warranty", text: "" },
        ],
        lineNumber: null,
        isGroupHeading: false,
        isAdditionalCharge: false,
      },
      {
        cells: [
          { key: "rate", text: "" },
          { key: "name", text: "Group B" },
          { key: "quantity", text: "" },
          { key: "amount", text: "" },
          { key: "warranty", text: "" },
        ],
        lineNumber: null,
        isGroupHeading: true,
        isAdditionalCharge: false,
      },
      {
        cells: [
          { key: "rate", text: "3,000" },
          { key: "name", text: "Support Plan" },
          { key: "quantity", text: "4" },
          { key: "amount", text: "\u20b9 12,000.00" },
          { key: "warranty", text: "" },
        ],
        lineNumber: 1,
        isGroupHeading: false,
        isAdditionalCharge: false,
      },
      {
        cells: [
          { key: "rate", text: "" },
          { key: "name", text: "Packing Charges" },
          { key: "quantity", text: "" },
          { key: "amount", text: "\u20b9 500.00" },
          { key: "warranty", text: "" },
        ],
        lineNumber: null,
        isGroupHeading: false,
        isAdditionalCharge: true,
      },
      {
        cells: [
          { key: "rate", text: "" },
          { key: "name", text: "Sub total" },
          { key: "quantity", text: "4.00" },
          { key: "amount", text: "\u20b9 12,000.00" },
          { key: "warranty", text: "" },
        ],
        lineNumber: null,
        isGroupHeading: false,
        isAdditionalCharge: false,
      },
    ]);
  });
});
