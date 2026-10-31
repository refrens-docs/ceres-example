/**
 * @jest-environment jsdom
 */
import {
  fitTotals,
  joinTotals,
  markTallRows,
  placeFootersOnPageEdge,
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

describe("Viraj Technologies — rows taller than a page's room", () => {
  afterEach(() => jest.restoreAllMocks());

  const rows = (heights: number[], pageHeight: number) => {
    printing(true);
    document.body.innerHTML = `<div class="vt-doc" style="--vt-print-height: ${pageHeight}px"><table class="vt-items"><thead data-h="40"><tr><th>Item</th></tr></thead><tbody><tr class="vt-item-row" data-h="${heights[0]}"><td>A</td></tr><tr class="vt-image-row" data-h="${heights[1]}"><td>img</td></tr><tr class="vt-item-row" data-h="${heights[2]}"><td>B</td></tr></tbody></table></div>`;
    jest
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        const height = Number((this as HTMLElement).dataset.h || 0);
        return {
          width: 500,
          height,
          top: 0,
          left: 0,
          right: 500,
          bottom: height,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });
    jest
      .spyOn(Element.prototype, "getClientRects")
      .mockImplementation(() => [{}] as unknown as DOMRectList);
    // Laid out at the print size 1 (jsdom lays nothing out).
    jest
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(500);
    markTallRows();
    return Array.from(document.querySelectorAll("tbody tr")).map((row) =>
      ["is-tall", "is-loose"].filter((c) => row.classList.contains(c)).join(" ")
    );
  };

  it("lets a row taller than an A5 page's room break, and an item outgrowing it break between its rows", () => {
    // A5: 718 px page, 40 px of headings: room 678 (under the 640 cap), so 640 is the limit.
    expect(rows([700, 100, 300], 718)).toEqual([
      "is-tall is-loose",
      "is-loose",
      "",
    ]);
    expect(rows([600, 100, 300], 718)).toEqual(["is-loose", "is-loose", ""]);
  });

  it("keeps items whole while they fit the page's room", () => {
    expect(rows([400, 100, 300], 1046)).toEqual(["", "", ""]);
  });

  it("uses the smaller room of a short page", () => {
    // A5 landscape: 483 px page less 40 px of headings.
    expect(rows([450, 0, 300], 483)).toEqual([
      "is-tall is-loose",
      "is-loose",
      "",
    ]);
  });
});

describe("Viraj footer on the last page — PDF service", () => {
  it("leaves the footer after the content while the print layout is not paginated", () => {
    // The PDF service switches to print media before it prints: forced breaks collapse, so a
    // page edge cannot be measured and the footer must not be pushed onto a page of its own.
    document.body.innerHTML =
      '<div class="vt-doc"><p>Content</p><div class="vt-letterhead-footer">Footer</div></div>';
    const footer = document.querySelector(
      ".vt-letterhead-footer"
    ) as HTMLElement;
    footer.getClientRects = () => [{}] as unknown as DOMRectList;
    footer.getBoundingClientRect = () =>
      ({
        top: 500,
        bottom: 560,
        height: 60,
        left: 0,
        right: 700,
        width: 700,
      } as DOMRect);
    let marker = 0;
    const realCreate = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const element = realCreate(tag);
      const top = 480 + 12 * marker;
      marker += 1;
      element.getBoundingClientRect = () => ({ top } as DOMRect);
      return element;
    });
    placeFootersOnPageEdge();
    jest.restoreAllMocks();
    expect(footer.style.breakBefore).toBe("");
    expect(footer.style.marginTop).toBe("");
  });
});
