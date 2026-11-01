/**
 * @jest-environment jsdom
 */
import { fitPrintTable } from "../src/templates/Ecommerce-Template/helpers";

const printing = (matches: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

/* A table in a 432 px box whose width shrinks with --ec-print-fit down to `atFloor`. */
const mount = (natural: number, atFloor: number) => {
  document.body.innerHTML = `<div class="ec-items-scroll"><table class="ec-items"><tbody><tr><td>1</td></tr></tbody></table></div>`;
  const table = document.querySelector<HTMLTableElement>(".ec-items")!;
  const box = table.parentElement!;
  const rect = (width: number) => ({ width } as DOMRect);
  box.getBoundingClientRect = () => rect(432);
  table.getBoundingClientRect = () => {
    const fit = parseFloat(table.style.getPropertyValue("--ec-print-fit")) || 1;
    // Text and padding shrink until their floors, at fit 0.5.
    return rect(atFloor + (natural - atFloor) * ((fit - 0.5) / 0.5));
  };
  return table;
};

describe("Ecommerce template — print table fit", () => {
  it("tightens a table too wide for the page but never shrinks its text", () => {
    printing(true);
    const table = mount(1800, 1100);
    fitPrintTable();
    expect(table.classList.contains("is-print-compact")).toBe(true);
    // Then the item column's content gives way and the padding goes to 1 px; text keeps its size.
    expect(table.classList.contains("is-print-tight")).toBe(true);
    expect(table.getAttribute("style") ?? "").toBe("");
    expect(table.classList.contains("is-print-fit")).toBe(false);
  });

  it("keeps the screen's padding for a table the estimate marked compact but that fits", () => {
    printing(true);
    const table = mount(420, 300);
    table.setAttribute("data-ec-print-compact", "");
    table.classList.add("is-print-compact");
    fitPrintTable();
    expect(table.classList.contains("is-print-compact")).toBe(false);
    expect(table.classList.contains("is-print-fit")).toBe(false);
    printing(false);
    fitPrintTable();
    expect(table.classList.contains("is-print-compact")).toBe(true);
  });

  it("tightens the padding of a table too wide at the screen's padding", () => {
    printing(true);
    const table = mount(700, 449);
    fitPrintTable();
    expect(table.classList.contains("is-print-compact")).toBe(true);
  });

  it("leaves a summary too wide for the page at its own text size", () => {
    printing(true);
    document.body.innerHTML = `<section class="ec-summary"><div><table class="ceres-table" id="wide"></table></div></section>`;
    const wide = document.getElementById("wide")!;
    wide.parentElement!.getBoundingClientRect = () =>
      ({ width: 432 } as DOMRect);
    wide.getBoundingClientRect = () => ({ width: 470 } as DOMRect);
    fitPrintTable();
    expect(wide.className).toBe("ceres-table");
    expect(wide.getAttribute("style")).toBeNull();
  });

  it("does nothing outside print, and clears an earlier fit", () => {
    printing(true);
    const table = mount(700, 449);
    fitPrintTable();
    printing(false);
    fitPrintTable();
    expect(table.classList.contains("is-print-compact")).toBe(false);
    expect(table.classList.contains("is-print-tight")).toBe(false);
  });
});
