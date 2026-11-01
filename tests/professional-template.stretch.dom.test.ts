/**
 * @jest-environment jsdom
 */
import {
  fitItemsToScreen,
  flowFiller,
  stretchItemTable,
  stretchPrintRules,
  type FlowUnit,
} from "../src/templates/professional-template/helpers";

const media = (print: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: print && query === "print",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const rect = (top: number, bottom: number, width = 1000) =>
  ({
    top,
    bottom,
    left: 0,
    right: width,
    width,
    height: bottom - top,
    x: 0,
    y: top,
  } as DOMRect);

/*
 * jsdom lays nothing out: the document's boxes are given here. One item row ending at
 * `itemEnd`, the totals after it ending at `end` (the body's foot), 1000 px wide.
 */
const mount = (classes = "", itemEnd = 500, end = 600) => {
  document.body.innerHTML = `<div class="pt-doc${classes}"><table class="pt-page-frame"><tbody><tr><td class="pt-page-frame-cell"><div class="pt-page-body"><div class="pt-items-scroll"><table class="pt-items"><tbody><tr class="pt-item-row"><td>1</td></tr><tr class="pt-filler"><td></td></tr></tbody></table></div><section class="pt-totals-row">Totals</section></div></td></tr></tbody></table></div>`;
  const doc = document.querySelector<HTMLElement>(".pt-doc") as HTMLElement;
  Object.defineProperty(doc, "offsetWidth", {
    configurable: true,
    value: 1000,
  });
  const set = (selector: string, box: DOMRect) => {
    const el = document.querySelector(selector) as HTMLElement;
    el.getBoundingClientRect = () => box;
  };
  set(".pt-doc", rect(0, end));
  set(".pt-page-body", rect(0, end));
  set(".pt-items-scroll", rect(0, itemEnd));
  set(".pt-items", rect(0, itemEnd));
  set(".pt-item-row", rect(0, itemEnd));
  set(".pt-totals-row", rect(itemEnd, end));
  const filler = doc.querySelector<HTMLElement>(".pt-filler") as HTMLElement;
  return { doc, filler };
};

const fillerHeight = (filler: HTMLElement) =>
  filler.style.getPropertyValue("--pt-filler-height");

const LAYOUT = { head: 0, foot: 0, start: 0 };
const room = (units: FlowUnit[], anchor: number, page: number) => {
  const length = flowFiller(units, anchor, { ...LAYOUT, page });
  return length ? length.c + length.k * page : undefined;
};

// The pages, simulated (user, 2026-11-01: the table runs to the foot of the page it ends on,
// one page or more).
describe("Professional Template — the stretch's pages", () => {
  it("fills what the table and the totals after it leave of a one-page document", () => {
    const units = [
      { top: 0, bottom: 400 },
      { top: 400, bottom: 600 },
    ];
    expect(room(units, 0, 1000)).toBe(400);
  });

  it("fills the page the table ends on when the document runs longer", () => {
    // Twelve 100 px items: the eleventh moves to page 2; the totals follow on page 2.
    const items = Array.from({ length: 12 }, (_, i) => ({
      top: i * 100,
      bottom: (i + 1) * 100,
    }));
    const units = [...items, { top: 1200, bottom: 1300 }];
    // Page 2 holds items 11 and 12 (200 px) and the totals (100 px): 700 px left.
    expect(room(units, 11, 1000)).toBe(700);
  });

  it("leaves the table as it is when the totals move to the next page", () => {
    const units = [
      { top: 0, bottom: 950 },
      { top: 950, bottom: 1100 },
    ];
    // The totals go to page 2: what is left of page 1 under the table is the room.
    expect(room(units, 0, 1000)).toBe(50);
  });

  it("does not stretch where a page break cuts a row before the table ends", () => {
    const units: FlowUnit[] = [
      { top: 0, bottom: 1500, fluid: true, line: 20 },
      { top: 1500, bottom: 1600 },
    ];
    expect(flowFiller(units, 0, { ...LAYOUT, page: 1000 })).toBeUndefined();
  });

  it("writes one print rule per range of page heights, in 100vh", () => {
    const css = stretchPrintRules(
      [
        { top: 0, bottom: 400 },
        { top: 400, bottom: 600 },
      ],
      0,
      LAYOUT,
      1,
      16
    );
    expect(css).toMatch(
      /@media print and \(min-height: \d+px\) and \(max-height: [\d.]+px\) \{ \.pt-doc\.is-stretch \.pt-items \.pt-filler \{ --pt-filler-height: max\(0px, calc\(1 \* 100vh \/ 1 - 616px\)\); \} \}/
    );
  });
});

// The preview always stretches, whatever the toggles (user, 2026-10-31; 2026-11-01: on the
// sheet the table ends on, one sheet or more).
describe("Professional Template — the preview's A4 sheet", () => {
  afterEach(() => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 0,
    });
  });

  it("gives a short document's spare height to the filler, toggles off", () => {
    media(false);
    const { doc, filler } = mount();
    stretchItemTable();
    // 1000 px wide: an A4 sheet is 1414 px tall; the document is 600.
    expect(fillerHeight(filler)).toBe("814px");
    expect(doc.classList.contains("is-filled")).toBe(true);
  });

  it("measures the same again with the filler in place (no loop)", () => {
    media(false);
    const { filler } = mount(" is-stretch");
    stretchItemTable();
    stretchItemTable();
    expect(fillerHeight(filler)).toBe("814px");
  });

  it("fills the sheet the table ends on in a longer document", () => {
    media(false);
    // The item ends at 1300 px on sheet 1 (1414 px tall); the totals (400 px) move to sheet 2.
    const { doc, filler } = mount("", 1300, 1700);
    stretchItemTable();
    // The table runs down to sheet 1's foot.
    expect(fillerHeight(filler)).toBe("114px");
    expect(doc.classList.contains("is-filled")).toBe(true);
  });

  it("leaves a Pageless document as it is", () => {
    media(false);
    const { doc, filler } = mount(" is-pageless");
    stretchItemTable();
    expect(fillerHeight(filler)).toBe("");
    expect(doc.classList.contains("is-filled")).toBe(false);
  });

  it("leaves the cards and grid layouts as they are", () => {
    media(false);
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 700,
    });
    const { doc, filler } = mount();
    fitItemsToScreen();
    expect(document.querySelector(".pt-items.is-grid")).not.toBeNull();
    expect(fillerHeight(filler)).toBe("");
    expect(doc.classList.contains("is-filled")).toBe(false);
  });

  // In print the business's toggle decides; the preview's filler goes.
  it("drops the preview's filler in print without the business toggle", () => {
    media(false);
    const { doc, filler } = mount();
    stretchItemTable();
    media(true);
    stretchItemTable();
    expect(fillerHeight(filler)).toBe("");
    expect(doc.classList.contains("is-filled")).toBe(false);
    // Print ends: the preview fills its sheet again.
    media(false);
    stretchItemTable();
    expect(fillerHeight(filler)).toBe("814px");
  });

  it("stretches in print with the business toggle, by page-height rules", () => {
    media(true);
    const { doc, filler } = mount(" is-stretch");
    stretchItemTable();
    expect(doc.classList.contains("is-filled")).toBe(true);
    expect(fillerHeight(filler)).toBe("");
    expect(document.getElementById("pt-stretch-pages")?.textContent).toMatch(
      /--pt-filler-height: max\(0px, calc\(1 \* 100vh/
    );
  });
});
