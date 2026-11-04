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
  it("cuts the totals at the frame's edge when the table is wider than the frame", () => {
    printing(true);
    const table = mount();
    Object.defineProperty(table, "offsetWidth", {
      value: 825,
      configurable: true,
    });
    Object.defineProperty(table.parentElement as HTMLElement, "clientWidth", {
      value: 555,
      configurable: true,
    });
    splitTotals();
    const split = table.nextElementSibling as HTMLTableElement;
    // Cut by its overhang of the box as it prints (100cqw), so a page turned to landscape with
    // room for it all cuts nothing; at least its laid-out width, more where the page has it.
    expect(split.style.clipPath).toBe(
      "inset(-2px max(0px, calc(100% - 100cqw)) -2px -2px)"
    );
    // (jsdom drops max(); Chrome takes "max(825px, 100%)".)
    expect(split.style.width).toContain("825px");
    // The TOTAL row stays on the item columns; the other totals and the words fit the frame.
    expect(split.querySelectorAll(".ec-items-total")).toHaveLength(1);
    const fit = split.nextElementSibling as HTMLTableElement;
    expect(fit.hasAttribute("data-ec-totals-fit")).toBe(true);
    expect(fit.style.width).toBe("100%");
    expect(fit.querySelectorAll(".ec-totals")).toHaveLength(1);
    joinTotals();
    // Joined back in order, the split tables gone.
    expect(Array.from(table.tBodies).map((body) => body.className)).toEqual([
      "",
      "ec-items-total",
      "ec-totals",
    ]);
    expect(table.nextElementSibling).toBeNull();
    // Right to left, the cut is on the left.
    table.style.direction = "rtl";
    splitTotals();
    expect((table.nextElementSibling as HTMLElement).style.clipPath).toBe(
      "inset(-2px -2px -2px max(0px, calc(100% - 100cqw)))"
    );
    joinTotals();
    table.style.direction = "";
    // One that fits is not clipped.
    Object.defineProperty(table, "offsetWidth", {
      value: 500,
      configurable: true,
    });
    splitTotals();
    expect((table.nextElementSibling as HTMLElement).style.clipPath).toBe("");
  });

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
