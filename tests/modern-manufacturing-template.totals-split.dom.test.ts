/**
 * @jest-environment jsdom
 */
import {
  joinTotals,
  splitTotals,
} from "../src/templates/modern-manufacturing-template/helpers";

const printing = (matches: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const mount = () => {
  document.body.innerHTML = `<div class="mm-items-scroll"><table class="mm-items"><thead><tr><th>Sr.</th><th>Item</th></tr></thead><tbody><tr><td>1</td><td>A</td></tr></tbody><tfoot><tr class="mm-total-row"><td>T</td><td>1</td></tr></tfoot></table></div>`;
  return document.querySelector<HTMLTableElement>(
    ".mm-items"
  ) as HTMLTableElement;
};

describe("Modern Manufacturing — totals in print", () => {
  it("moves the totals into a table of their own, without the item headings", () => {
    printing(true);
    const table = mount();
    splitTotals();
    const split = table.nextElementSibling as HTMLTableElement;
    expect(split.hasAttribute("data-mm-totals-split")).toBe(true);
    expect(split.querySelector("thead")).toBeNull();
    expect(split.querySelectorAll(".mm-total-row")).toHaveLength(1);
    expect(table.querySelectorAll(".mm-total-row")).toHaveLength(0);
    expect(split.querySelectorAll("col")).toHaveLength(2);
    // The item table keeps the same columns, so the totals stay under them.
    expect(
      table.querySelectorAll(":scope > colgroup[data-mm-totals-split] col")
    ).toHaveLength(2);
    expect(table.style.tableLayout).toBe("fixed");
  });

  it("gives the item table its own sizing and style back when joined", () => {
    printing(true);
    const table = mount();
    table.setAttribute("style", "--mm-figures: 3");
    splitTotals();
    joinTotals();
    expect(table.querySelector("colgroup")).toBeNull();
    expect(table.getAttribute("style")).toBe("--mm-figures: 3");
    expect(table.dataset.mmTotalsStyle).toBeUndefined();
    const bare = mount();
    splitTotals();
    joinTotals();
    expect(bare.hasAttribute("style")).toBe(false);
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
