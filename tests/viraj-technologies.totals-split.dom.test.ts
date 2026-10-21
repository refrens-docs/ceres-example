/**
 * @jest-environment jsdom
 */
import {
  fitTotals,
  joinTotals,
  splitTotals,
} from "../src/templates/viraj-technologies/helpers";

const printing = (matches: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const mount = () => {
  document.body.innerHTML = `<div class="vt-items-scroll"><table class="vt-items"><thead><tr><th>Sr.</th><th>Item</th></tr></thead><tbody><tr><td>1</td><td>A</td></tr></tbody><tbody class="vt-items-total"><tr><td>T</td><td>1</td></tr></tbody><tbody class="vt-totals"><tr><td colspan="2">Sub Total</td></tr></tbody></table></div>`;
  return document.querySelector<HTMLTableElement>(
    ".vt-items"
  ) as HTMLTableElement;
};

describe("Viraj Technologies — totals in print", () => {
  it("moves the totals into a table of their own, without the item headings", () => {
    printing(true);
    const table = mount();
    splitTotals();
    const split = table.nextElementSibling as HTMLTableElement;
    expect(split.hasAttribute("data-vt-totals-split")).toBe(true);
    expect(split.querySelector("thead")).toBeNull();
    expect(split.querySelectorAll(".vt-items-total, .vt-totals")).toHaveLength(
      2
    );
    expect(table.querySelectorAll(".vt-items-total, .vt-totals")).toHaveLength(
      0
    );
    expect(split.querySelectorAll("col")).toHaveLength(2);
  });

  it("leaves the table whole outside print, and joins it back in order", () => {
    printing(false);
    const table = mount();
    const before = table.innerHTML;
    splitTotals();
    expect(table.nextElementSibling).toBeNull();
    printing(true);
    splitTotals();
    joinTotals();
    expect(table.nextElementSibling).toBeNull();
    expect(table.innerHTML).toBe(before);
  });
});

describe("Viraj Technologies — totals figures never widen a column", () => {
  // Widths come from data-w; every cell counts as laid out.
  beforeAll(() => {
    jest
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        const width = Number((this as HTMLElement).dataset.w || 0);
        return {
          width,
          height: 20,
          top: 0,
          left: 0,
          right: width,
          bottom: 20,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });
    jest
      .spyOn(Element.prototype, "getClientRects")
      .mockImplementation(() => [{}] as unknown as DOMRectList);
  });
  afterAll(() => jest.restoreAllMocks());

  const totals = (figure: number) => {
    document.body.innerHTML = `<table class="vt-items"><tbody><tr><td data-w="40">1</td><td data-w="200">A</td><td data-w="60">₹69</td><td data-w="70">₹69.00</td></tr></tbody><tbody class="vt-totals"><tr class="ceres-subtotal-row"><th class="ceres-subtotal-label" colspan="3">Sub Total</th><td class="ceres-subtotal-value" style="padding: 0 6px"><div class="vt-fig"><span data-w="${figure}">₹207.00</span></div></td></tr><tr class="ceres-subtotal-row"><th class="ceres-subtotal-label" colspan="3">Shipping</th><td class="ceres-subtotal-value" style="padding: 0 6px"><div class="vt-fig"><span data-w="40">₹0.00</span></div></td></tr></tbody></table>`;
    fitTotals();
    return Array.from(
      document.querySelectorAll<HTMLTableRowElement>(".ceres-subtotal-row")
    ).map((row) => [row.cells[0].colSpan, row.cells[1].colSpan]);
  };

  it("keeps a figure that fits in the last column", () => {
    expect(totals(50)).toEqual([
      [3, 1],
      [3, 1],
    ]);
  });

  it("gives every row's figure the columns the widest one needs, from the label", () => {
    expect(totals(90)).toEqual([
      [2, 2],
      [2, 2],
    ]);
  });
});
