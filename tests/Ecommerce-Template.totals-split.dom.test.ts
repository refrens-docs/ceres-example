/**
 * @jest-environment jsdom
 */
import {
  joinTotals,
  splitTotals,
} from "../src/templates/Ecommerce-Template/helpers";

const printing = (matches: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const mount = () => {
  document.body.innerHTML = `<div class="ec-items-scroll"><table class="ec-items"><thead><tr><th>Sr.</th><th>Item</th></tr></thead><tbody><tr><td>1</td><td>A</td></tr></tbody><tbody class="ec-items-total"><tr><td>T</td><td>1</td></tr></tbody><tbody class="ec-totals"><tr><td colspan="2">Sub Total</td></tr></tbody><tfoot class="ec-page-close"><tr><td colspan="2"></td></tr></tfoot></table></div>`;
  return document.querySelector<HTMLTableElement>(
    ".ec-items"
  ) as HTMLTableElement;
};

describe("Ecommerce template — totals in print", () => {
  it("moves the totals into a table of their own, without the item headings", () => {
    printing(true);
    const table = mount();
    splitTotals();
    const split = table.nextElementSibling as HTMLTableElement;
    expect(split.hasAttribute("data-ec-totals-split")).toBe(true);
    expect(split.querySelector("thead")).toBeNull();
    expect(split.querySelectorAll(".ec-items-total, .ec-totals")).toHaveLength(
      2
    );
    expect(table.querySelectorAll(".ec-items-total, .ec-totals")).toHaveLength(
      0
    );
    expect(split.querySelectorAll("col")).toHaveLength(2);
    // The item table keeps the very same columns, so its rules meet the totals'.
    expect(table.querySelectorAll(":scope > colgroup > col")).toHaveLength(2);
    expect(table.style.tableLayout).toBe("fixed");
    expect(table.style.width).toBe(split.style.width);
  });

  it("leaves the table whole outside print, and joins it back in order", () => {
    printing(false);
    const table = mount();
    table.setAttribute("style", "--ec-print-fit: 0.9;");
    const before = table.outerHTML;
    splitTotals();
    expect(table.nextElementSibling).toBeNull();
    printing(true);
    splitTotals();
    joinTotals();
    expect(table.nextElementSibling).toBeNull();
    expect(table.outerHTML).toBe(before);
  });
});
