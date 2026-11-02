/**
 * @jest-environment jsdom
 */
import {
  applyInvoiceUpdate,
  applyTemplateUpdate,
  loadScriptFont,
  resetItemsTableStretch,
  stretchItemsTable,
  fillPages,
  itemsFillRules,
  type PageUnit,
  stretchItemsToSheet,
  footerEdgeGap,
  placeFootersOnPageEdge,
  registerModernManufacturingPrint,
  resetFootersOnPageEdge,
  respellTaxWords,
  drawRiyalSigns,
  stackCrampedFields,
  labelSummaryCells,
  printMediaText,
  withPrintRules,
  prepareBrowserPrint,
  setModernManufacturingStylesheetText,
  withReadableStylesheet,
} from "../src/templates/modern-manufacturing-template/helpers";

/*
 * jsdom has no layout, so each test describes the printed pages: where the page holding the
 * end of the content ends, how tall a page is, where the footer sits, and the print zoom.
 */
interface Layout {
  pageEnd: number;
  pageHeight: number;
  footerTop: number;
  footerHeight: number;
  scale?: number;
  // Where the footer starts once it is forced onto a page of its own.
  brokenTop?: number;
  // Extra laid-out pixels the footer ends up lower than asked (a misjudged placement).
  drift?: number;
  hidden?: boolean;
}

const rect = (top: number, height: number) =>
  ({ top, height, bottom: top + height } as DOMRect);

const mockLayout = (layout: Layout) => {
  const scale = layout.scale ?? 1;
  let markers = 0;
  jest
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function measure(this: HTMLElement) {
      if (this.style.breakBefore === "page" && !this.classList.length) {
        markers += 1;
        return rect(
          markers % 2 === 1
            ? layout.pageEnd
            : layout.pageEnd + layout.pageHeight,
          0
        );
      }
      if (this.style.height === "1000px") return rect(0, 1000 * scale);
      if (this.classList.contains("mm-letterhead-footer")) {
        const top =
          this.style.breakBefore === "page"
            ? layout.brokenTop ?? layout.pageEnd
            : layout.footerTop;
        const margin = parseFloat(this.style.marginTop) || 0;
        const drift = margin ? layout.drift ?? 0 : 0;
        return rect(top + margin * scale + drift, layout.footerHeight);
      }
      return rect(0, 0);
    });
  jest
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockImplementation(
      () => (layout.hidden ? [] : [rect(0, 1)]) as unknown as DOMRectList
    );
};

const footer = () =>
  document.querySelector<HTMLElement>(".mm-letterhead-footer") as HTMLElement;

beforeEach(() => {
  document.body.innerHTML =
    '<div class="mm-doc"><p>Content</p><div class="no-dibella invoice-letterhead-footer mm-letterhead-footer">Footer</div></div>';
});

afterEach(() => jest.restoreAllMocks());

describe("Modern Manufacturing — footer on the last page's bottom edge", () => {
  it("computes the space above the footer, 2 px spare", () => {
    const base = { pageEnd: 1000, pageHeight: 1000, footerHeight: 100 };
    expect(footerEdgeGap({ ...base, footerTop: 500 })).toBe(398);
    // Not under the content: the next page's foot.
    expect(footerEdgeGap({ ...base, footerTop: 950 })).toBe(948);
    expect(footerEdgeGap({ ...base, footerTop: 899 })).toBe(0);
    expect(footerEdgeGap({ ...base, pageHeight: 0, footerTop: 500 })).toBe(0);
    expect(footerEdgeGap({ ...base, footerHeight: 0, footerTop: 500 })).toBe(0);
  });

  it("ends the footer on the page that holds the end of the content", () => {
    mockLayout({
      pageEnd: 1000,
      pageHeight: 1000,
      footerTop: 500,
      footerHeight: 100,
    });
    placeFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("398px");
    expect(footer().style.breakBefore).toBe("");
    // The measuring markers and probe are gone.
    expect(document.querySelector(".mm-doc")?.children.length).toBe(2);
  });

  it("writes the margin in the footer's own pixels under the print zoom", () => {
    mockLayout({
      pageEnd: 1100,
      pageHeight: 1100,
      footerTop: 550,
      footerHeight: 110,
      scale: 1.1,
    });
    placeFootersOnPageEdge();
    expect(parseFloat(footer().style.marginTop)).toBeCloseTo(438 / 1.1, 5);
  });

  it("reads the margin as is when the zoom probe cannot be measured", () => {
    mockLayout({
      pageEnd: 1000,
      pageHeight: 1000,
      footerTop: 500,
      footerHeight: 100,
      scale: 0,
    });
    placeFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("398px");
  });

  it("gives a footer that does not fit a page of its own, ending at its foot", () => {
    mockLayout({
      pageEnd: 1000,
      pageHeight: 1000,
      footerTop: 950,
      footerHeight: 100,
      brokenTop: 1000,
    });
    placeFootersOnPageEdge();
    expect(footer().style.breakBefore).toBe("page");
    expect(footer().style.marginTop).toBe("898px");
  });

  it("falls back to following the content when the placement misses", () => {
    mockLayout({
      pageEnd: 1000,
      pageHeight: 1000,
      footerTop: 500,
      footerHeight: 100,
      drift: 10,
    });
    placeFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("");
  });

  it("leaves a footer alone that already ends on the edge, or is not drawn", () => {
    mockLayout({
      pageEnd: 1000,
      pageHeight: 1000,
      footerTop: 899,
      footerHeight: 100,
    });
    placeFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("");

    jest.restoreAllMocks();
    mockLayout({
      pageEnd: 1000,
      pageHeight: 1000,
      footerTop: 500,
      footerHeight: 100,
      hidden: true,
    });
    placeFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("");
  });

  it("leaves the footer alone where the print is laid out but not paginated", () => {
    // Refrens' PDF service switches to print media first: forced breaks collapse.
    mockLayout({
      pageEnd: 1000,
      pageHeight: 150,
      footerTop: 500,
      footerHeight: 100,
    });
    placeFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("");
    expect(footer().style.breakBefore).toBe("");
  });

  it("only places the last-page footer, never the fixed or empty one", () => {
    footer().classList.add("mm-footer-fixed");
    footer().style.marginTop = "5px";
    placeFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("5px");
  });

  it("clears the placement after printing", () => {
    footer().style.marginTop = "40px";
    footer().style.breakBefore = "page";
    resetFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("");
    expect(footer().style.breakBefore).toBe("");
  });
});

describe("Modern Manufacturing — print registration", () => {
  type Listener = (event: { matches: boolean }) => void;
  let listeners: Listener[];

  const registered = () =>
    window as typeof window & { mmPrintRegistered?: boolean };

  beforeEach(() => {
    listeners = [];
    delete registered().mmPrintRegistered;
    window.matchMedia = jest.fn().mockReturnValue({
      addEventListener: (_: string, listener: Listener) =>
        listeners.push(listener),
    });
    window.history.replaceState(null, "", "/");
  });

  it("places on entering print layout and clears on leaving it, once", () => {
    mockLayout({
      pageEnd: 1000,
      pageHeight: 1000,
      footerTop: 500,
      footerHeight: 100,
    });
    registerModernManufacturingPrint();
    registerModernManufacturingPrint();
    expect(listeners).toHaveLength(1);

    listeners[0]({ matches: true });
    expect(footer().style.marginTop).toBe("398px");
    listeners[0]({ matches: false });
    expect(footer().style.marginTop).toBe("");

    footer().style.marginTop = "12px";
    window.dispatchEvent(new Event("afterprint"));
    expect(footer().style.marginTop).toBe("");
  });

  it("runs inside Lydia too, and stays out of browsers without matchMedia", () => {
    // isLydiaMode is Lydia's embedded preview, where the template is printed from.
    window.history.replaceState(null, "", "/?isLydiaMode=1");
    registerModernManufacturingPrint();
    expect(listeners).toHaveLength(1);

    delete registered().mmPrintRegistered;
    (window as { matchMedia?: unknown }).matchMedia = undefined;
    registerModernManufacturingPrint();
    expect(registered().mmPrintRegistered).toBeUndefined();
  });
});

describe("Modern Manufacturing — script font", () => {
  it("loads the script's Google font once, and nothing without one", () => {
    loadScriptFont("");
    expect(document.head.querySelectorAll("link")).toHaveLength(0);

    loadScriptFont("Noto Sans Arabic");
    loadScriptFont("Noto Sans Arabic");
    const links = document.head.querySelectorAll("link");
    expect(links).toHaveLength(1);
    expect(links[0].id).toBe("mm-script-font-noto-sans-arabic");
    expect(links[0].getAttribute("href")).toBe(
      "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap"
    );
  });
});

const lastRow = () =>
  document.querySelector<HTMLElement>(
    ".mm-items > tbody > tr:last-child"
  ) as HTMLElement;

/*
 * The page fill: jsdom lays nothing out, so each element carries its box as data-top and data-h
 * (layout px from the first page's top); a 1000 px probe gives the layout scale.
 */
const mockBoxes = (scale = 1) => {
  jest
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function measure(this: HTMLElement) {
      if (this.style.height === "1000px") return rect(0, 1000 * scale);
      const top = Number(this.dataset.top ?? 0);
      return rect(top * scale, Number(this.dataset.h ?? 0) * scale);
    });
  jest
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockImplementation(() => [rect(0, 1)] as unknown as DOMRectList);
};

// A header, three items (the last two moving on: item 2 does not fit under item 1), a summary.
const page = (stretch = true, extra = "") => {
  document.body.innerHTML = `<div class="mm-doc"${
    stretch ? " data-mm-stretch-table" : ""
  }${extra}><div class="mm-page-body"><header data-top="0" data-h="300"></header><section class="mm-items-section" data-top="300" data-h="1000"><table class="mm-items"><thead data-top="300" data-h="40"><tr><th>h</th></tr></thead><tbody><tr class="mm-item-row" data-top="340" data-h="360"><td>1</td></tr><tr class="mm-item-row" data-top="700" data-h="200"><td>2</td></tr><tr class="mm-item-row" data-top="900" data-h="400"><td>3</td></tr></tbody></table></section><section class="mm-summary-row" data-top="1310" data-h="190"></section><p class="mm-contact" data-top="1510" data-h="20"></p></div></div>`;
};

const units = (): PageUnit[] => [
  { top: 0, bottom: 300, solid: true },
  { top: 300, bottom: 700, solid: true, fill: 0, head: 40 },
  { top: 700, bottom: 900, solid: true, fill: 1, head: 40 },
  { top: 900, bottom: 1300, solid: true, fill: 2, head: 40 },
  { top: 1310, bottom: 1500, solid: true },
  { top: 1510, bottom: 1530, solid: false },
];

const fillRules = () =>
  document.getElementById("mm-fill-rules")?.textContent ?? "";

describe("Modern Manufacturing — the table fills every page it prints on", () => {
  it("gives the room an item leaves at a page break to it, and the last page's room to the last item", () => {
    const fills = fillPages(units(), 1000, { head: 0, foot: 0 });
    // Page 1: item 3 moves on, item 2 takes the 100 px under it.
    expect(fills.get(1)).toEqual({ c: -900, k: 1 });
    expect(fills.get(0)).toBeUndefined();
    // Page 2: item 3 (under the repeated headings), the summary and the contact line, 330 px left.
    expect(fills.get(2)).toEqual({ c: -670, k: 1 });
    expect(fills.get(2)!.c + fills.get(2)!.k * 1000).toBe(330);
  });

  it("keeps the page frame's repeated bands out of every page", () => {
    const fills = fillPages(units(), 1000, { head: 50, foot: 30 });
    expect(fills.get(1)).toEqual({ c: -930, k: 1 });
  });

  it("fills nothing past an item cut by a page break, nor on a page that ends in cut text", () => {
    const tall: PageUnit[] = [
      { top: 0, bottom: 1500, solid: true, fill: 0, head: 40 },
      { top: 1500, bottom: 1600, solid: true, fill: 1, head: 40 },
    ];
    expect(fillPages(tall, 1000, { head: 0, foot: 0 }).size).toBe(0);
    const text: PageUnit[] = [
      { top: 0, bottom: 500, solid: true, fill: 0, head: 40 },
      { top: 510, bottom: 1400, solid: false },
    ];
    expect(fillPages(text, 1000, { head: 0, foot: 0 }).size).toBe(0);
  });

  it("writes one print rule per range of page heights, in 100vh, a little kept back", () => {
    const css = itemsFillRules(
      units(),
      [360, 200, 400],
      { head: 0, foot: 0 },
      1
    );
    const at1000 = css.split("\n").find((rule) => {
      const [, from, to] =
        rule.match(/min-height: (\d+)px\) and \(max-height: ([\d.]+)px/) ?? [];
      return Number(from) <= 1000 && Number(to) >= 1000;
    });
    expect(at1000).toContain(
      'tr[data-mm-fill="1"] { height: calc(200px + 1 * 100vh / 1 + -916px); }'
    );
    expect(at1000).toContain(
      'tr[data-mm-fill="1"] > td { vertical-align: top; }'
    );
    expect(at1000).toContain(".mm-doc:not([data-mm-measuring])");
    // Under a zoom the page holds fewer of the document's pixels.
    expect(
      itemsFillRules(units(), [360, 200, 400], { head: 0, foot: 0 }, 1.25)
    ).toContain("100vh / 1.25");
  });

  it("marks the item rows and writes the rules; always on, never on a Pageless document", () => {
    page();
    mockBoxes();
    stretchItemsTable();
    const rows = document.querySelectorAll(".mm-items tr[data-mm-fill]");
    expect([...rows].map((row) => row.getAttribute("data-mm-fill"))).toEqual([
      "0",
      "1",
      "2",
    ]);
    expect(fillRules()).toContain('tr[data-mm-fill="1"]');
    expect(document.querySelector("[data-mm-measuring]")).toBeNull();

    page(true, " data-mm-pageless");
    stretchItemsTable();
    expect(document.querySelectorAll("[data-mm-fill]").length).toBe(0);
    expect(fillRules()).toBe("");

    document.body.innerHTML =
      '<div class="mm-doc" data-mm-stretch-table></div>';
    expect(() => stretchItemsTable()).not.toThrow();
  });

  it("measures in the row's own pixels under the print zoom", () => {
    page();
    mockBoxes(1.25);
    stretchItemsTable();
    expect(fillRules()).toContain("calc(200px +");
  });

  it("clears the preview's stretch", () => {
    page();
    lastRow().style.height = "300px";
    lastRow().setAttribute("data-mm-stretched", "");
    resetItemsTableStretch();
    expect(lastRow().style.height).toBe("");
    expect(lastRow().hasAttribute("data-mm-stretched")).toBe(false);
  });

  it("ignores Lydia's live document toggle", () => {
    const doc = () => document.querySelector(".mm-doc") as HTMLElement;
    page(true);
    applyTemplateUpdate({
      type: "lydia:template-update",
      template: { pdfOptions: { fullHeightTable: false } },
    });
    expect(doc().hasAttribute("data-mm-stretch-table")).toBe(true);
    applyTemplateUpdate({ type: "lydia:print" });
    applyTemplateUpdate(null);
    expect(doc().hasAttribute("data-mm-stretch-table")).toBe(true);
  });

  it("follows Lydia's live theme colour, with its tint", () => {
    page(false);
    const doc = () => document.querySelector(".mm-doc") as HTMLElement;
    const update = (template: unknown) =>
      applyTemplateUpdate({ type: "lydia:template-update", template });

    update({ templateColor: { primaryColor: "#B91C1C" } });
    expect(doc().style.getPropertyValue("--mm-theme")).toBe("#b91c1c");
    expect(doc().style.getPropertyValue("--mm-theme-tint")).toMatch(
      /^#[0-9a-f]{6}$/
    );
    update({ primaryColor: "#0a0" });
    expect(doc().style.getPropertyValue("--mm-theme")).toBe("#00aa00");
    // Not a colour: unchanged. The default blue: the stylesheet's own.
    update({ primaryColor: "red" });
    expect(doc().style.getPropertyValue("--mm-theme")).toBe("#00aa00");
    update({ primaryColor: "#013D7F" });
    expect(doc().style.getPropertyValue("--mm-theme")).toBe("");
    expect(doc().style.getPropertyValue("--mm-theme-tint")).toBe("");
  });

  it("stretches before placing the footer when printing, whatever Lydia's toggle says", () => {
    type Listener = (event: { matches: boolean }) => void;
    const listeners: Listener[] = [];
    const state = window as typeof window & { mmPrintRegistered?: boolean };
    delete state.mmPrintRegistered;
    window.matchMedia = jest.fn().mockReturnValue({
      addEventListener: (_: string, listener: Listener) =>
        listeners.push(listener),
    });
    window.history.replaceState(null, "", "/");
    page(true);
    mockBoxes();
    registerModernManufacturingPrint();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "lydia:template-update",
          template: { pdfOptions: { fullHeightTable: false } },
        },
      })
    );
    listeners[0]({ matches: true });
    expect(fillRules()).toContain('tr[data-mm-fill="1"]');
    listeners[0]({ matches: false });

    lastRow().style.height = "50px";
    lastRow().setAttribute("data-mm-stretched", "");
    window.dispatchEvent(new Event("afterprint"));
    expect(lastRow().style.height).toBe("");
  });

  it("lays the page out for print when it renders already in print media (the PDF service)", () => {
    // Real A00052-E (1.0.50): the PDF service was in print media before the template
    // rendered, no switch to print came, and the table never stretched.
    jest.useFakeTimers();
    const state = window as typeof window & { mmPrintRegistered?: boolean };
    delete state.mmPrintRegistered;
    window.matchMedia = ((query: string) => ({
      matches: query === "print",
      media: query,
      addEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    window.history.replaceState(null, "", "/");
    page(true);
    mockBoxes();
    registerModernManufacturingPrint();
    jest.runOnlyPendingTimers();
    expect(fillRules()).toContain('tr[data-mm-fill="1"]');
    jest.useRealTimers();
  });
});

describe("Modern Manufacturing — the preview's table stretched to an A4 sheet", () => {
  // jsdom lays nothing out: the sheet is `width` wide and `height` tall before the stretch
  // (the stretched row's own extra counted in), its last row `rowHeight`.
  const mockSheet = (width: number, height: number, rowHeight = 40) => {
    const row = () =>
      document.querySelector<HTMLElement>(
        ".mm-items > tbody > tr:last-child"
      ) as HTMLElement;
    jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function measure(this: HTMLElement) {
        const added = (parseFloat(row().style.height) || rowHeight) - rowHeight;
        if (this.classList.contains("mm-doc")) {
          return { ...rect(0, height + added), width } as DOMRect;
        }
        if (this === row()) return rect(0, rowHeight + added);
        return rect(0, 0);
      });
    jest
      .spyOn(HTMLElement.prototype, "getClientRects")
      .mockImplementation(() => [rect(0, 1)] as unknown as DOMRectList);
  };
  const media = (print: boolean) => {
    window.matchMedia = ((query: string) => ({
      matches: print && query === "print",
      media: query,
      addEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
  };

  beforeEach(() => media(false));
  // A desktop window, so the table stays a table (fitItemsToScreen) when printing ends.
  beforeAll(() =>
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      get: () => 1200,
    })
  );
  afterAll(() => {
    delete (document.documentElement as { clientWidth?: number }).clientWidth;
  });

  it("fills a short document to one A4 sheet, whatever either toggle says", () => {
    [true, false].forEach((business) => {
      page(business);
      mockSheet(840, 700);
      stretchItemsToSheet();
      // 840 × 297 / 210 = 1188 px tall: 488 px more on the last row.
      expect(lastRow().style.height).toBe("528px");
      expect(lastRow().hasAttribute("data-mm-stretched")).toBe(true);
      // Measured again, without its own extra height: the same, never growing.
      stretchItemsToSheet();
      expect(lastRow().style.height).toBe("528px");
      jest.restoreAllMocks();
    });
  });

  it("leaves a document taller than the sheet, a Pageless one and the phone layouts as they are", () => {
    page(false);
    mockSheet(840, 1300);
    stretchItemsToSheet();
    expect(lastRow().style.height).toBe("");
    expect(lastRow().hasAttribute("data-mm-stretched")).toBe(false);

    page(false, " data-mm-pageless");
    stretchItemsToSheet();
    expect(lastRow().style.height).toBe("");

    ["is-cards", "is-grid"].forEach((layout) => {
      page(false);
      document.querySelector(".mm-items")?.classList.add(layout);
      jest.restoreAllMocks();
      mockSheet(840, 700);
      stretchItemsToSheet();
      expect(lastRow().style.height).toBe("");
    });
  });

  it("drops a stretch the sheet no longer needs", () => {
    page(false);
    mockSheet(840, 1300);
    lastRow().style.height = "300px";
    lastRow().setAttribute("data-mm-stretched", "");
    stretchItemsToSheet();
    expect(lastRow().style.height).toBe("");
  });

  it("leaves printing to the print stretch, and comes back after printing", () => {
    type Listener = (event: { matches: boolean }) => void;
    const listeners: Listener[] = [];
    const state = window as typeof window & { mmPrintRegistered?: boolean };
    delete state.mmPrintRegistered;
    let printing = false;
    window.matchMedia = ((query: string) => ({
      matches: printing && query === "print",
      media: query,
      addEventListener: (_: string, listener: Listener) =>
        listeners.push(listener),
    })) as unknown as typeof window.matchMedia;
    window.history.replaceState(null, "", "/");
    // The business without the stretch: nothing in print, the sheet filled on screen.
    page(false);
    mockSheet(840, 700);
    registerModernManufacturingPrint();
    stretchItemsToSheet();
    expect(lastRow().style.height).toBe("528px");

    // A print stretch already in place (the PDF service) is never undone by the preview's.
    printing = true;
    listeners[0]({ matches: true });
    expect(lastRow().style.height).toBe("");
    lastRow().style.height = "77px";
    lastRow().setAttribute("data-mm-stretched", "");
    stretchItemsToSheet();
    expect(lastRow().style.height).toBe("77px");

    // Back on screen: the sheet is filled again; not between beforeprint and afterprint.
    printing = false;
    listeners[0]({ matches: false });
    expect(lastRow().style.height).toBe("528px");
    jest.spyOn(document, "querySelector").mockReturnValueOnce(null);
    window.dispatchEvent(new Event("beforeprint"));
    lastRow().style.removeProperty("height");
    lastRow().removeAttribute("data-mm-stretched");
    listeners[0]({ matches: false });
    expect(lastRow().style.height).toBe("");
    window.dispatchEvent(new Event("afterprint"));
    expect(lastRow().style.height).toBe("528px");
  });

  it("measures the sheet again after Lydia's live updates", () => {
    jest.useFakeTimers();
    page(false);
    mockSheet(840, 700);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "lydia:template-update", template: {} },
      })
    );
    jest.runOnlyPendingTimers();
    expect(lastRow().style.height).toBe("528px");
    jest.useRealTimers();
  });
});

describe("Modern Manufacturing — a wide table prints at the document's text size", () => {
  // User, 2026-11-01: the table keeps the text scale like the rest of the page (it may run off a
  // portrait page; landscape shows it whole). No print step shrinks or zooms it.
  it("leaves a table wider than its page as it is, before a browser print and in print", () => {
    const state = window as typeof window & { mmPrintRegistered?: boolean };
    delete state.mmPrintRegistered;
    document.body.innerHTML =
      '<div class="mm-doc" style="--mm-print-width: 714px;"><div class="mm-items-scroll"><table class="mm-items"></table></div></div>';
    jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function measure(this: HTMLElement) {
        return {
          width: this.classList.contains("mm-items") ? 1400 : 714,
        } as DOMRect;
      });
    let onChange: ((event: { matches: boolean }) => void) | undefined;
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: (_: string, listener: typeof onChange) => {
        onChange = listener;
      },
    });
    registerModernManufacturingPrint();
    window.dispatchEvent(new Event("beforeprint"));
    onChange?.({ matches: true });
    const table = document.querySelector<HTMLElement>(
      ".mm-items"
    ) as HTMLElement;
    expect(table.classList.contains("is-print-fit")).toBe(false);
    expect(table.style.getPropertyValue("--mm-print-fit")).toBe("");
    expect(table.style.getPropertyValue("--mm-print-squeeze")).toBe("");
    jest.restoreAllMocks();
  });
});

describe("Modern Manufacturing — the tax summary's words in the document's currency", () => {
  const summary = (currency: string | null, total = "\u20c1 18.00") =>
    `<div class="mm-doc"${
      currency ? ` data-mm-currency="${currency}"` : ""
    }><div data-ceres-tax-summary><table><tr><td>18%</td><td>${total}</td></tr><tr><td>Total</td><td></td><td>${total}</td></tr><tr><td class="ceres-table-words">Total Tax In Words: EIGHTEEN RUPEES ONLY</td></tr></table></div></div>`;
  const words = () => document.querySelector(".ceres-table-words")?.textContent;

  it("rewrites the line from the table's Total in the document's currency", () => {
    document.body.innerHTML = summary("SAR");
    respellTaxWords();
    expect(words()).toBe("Total Tax In Words: EIGHTEEN RIYALS ONLY");
    // Already right: left as it is.
    respellTaxWords();
    expect(words()).toBe("Total Tax In Words: EIGHTEEN RIYALS ONLY");
  });

  it("leaves a rupee document, and a Total without a figure, as the widget wrote them", () => {
    document.body.innerHTML = summary(null);
    respellTaxWords();
    expect(words()).toBe("Total Tax In Words: EIGHTEEN RUPEES ONLY");

    document.body.innerHTML = summary("SAR", "-");
    respellTaxWords();
    expect(words()).toBe("Total Tax In Words: EIGHTEEN RUPEES ONLY");

    document.body.innerHTML =
      '<div class="mm-doc" data-mm-currency="SAR"><div data-ceres-tax-summary><p class="ceres-table-words">Total Tax In Words: X</p></div></div>';
    respellTaxWords();
    expect(words()).toBe("Total Tax In Words: X");
  });

  it("follows every render into the page", async () => {
    document.body.innerHTML = '<div id="documentOutput"></div>';
    const state = window as typeof window & { mmPrintRegistered?: boolean };
    delete state.mmPrintRegistered;
    window.matchMedia = jest
      .fn()
      .mockReturnValue({ addEventListener: () => undefined });
    registerModernManufacturingPrint();
    (document.getElementById("documentOutput") as HTMLElement).innerHTML =
      summary("SAR");
    await Promise.resolve();
    expect(words()).toBe("Total Tax In Words: EIGHTEEN RIYALS ONLY");
    // The riyal sign is drawn on the same pass.
    expect(document.querySelectorAll("svg.mm-riyal").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("\u20c1");
  });
});

describe("Modern Manufacturing — the Saudi riyal sign", () => {
  it("draws every sign in the document, in the text's place, and leaves other text alone", () => {
    document.body.innerHTML =
      '<p class="outside">\u20c1 1.00</p><div class="mm-doc"><span>\u20c1 100.00</span><i class="paid">(\u20c1 118.00) / \u20c1\u20c1</i><b>\u20b9 5.00</b></div>';
    drawRiyalSigns();
    const doc = document.querySelector(".mm-doc") as HTMLElement;
    const signs = doc.querySelectorAll("svg.mm-riyal");
    expect(signs).toHaveLength(4);
    expect(doc.textContent).toBe(" 100.00( 118.00) / \u20b9 5.00");
    expect(signs[0].getAttribute("aria-label")).toBe("SAR");
    expect(signs[0].getAttribute("viewBox")).toBe("50 6 1124 1256");
    expect(signs[0].querySelector("path")?.getAttribute("d")).toMatch(
      /^M750,1119C/
    );
    // The sign sits where the character was: before the amount, inside the parentheses.
    expect((doc.querySelector(".paid") as HTMLElement).innerHTML).toMatch(
      /^\(<svg[^>]*>.*?<\/svg> 118\.00\) \/ <svg/
    );
    // Outside the document, nothing is touched; a second pass finds nothing left.
    expect(document.querySelector(".outside")?.textContent).toBe("\u20c1 1.00");
    drawRiyalSigns();
    expect(doc.querySelectorAll("svg.mm-riyal")).toHaveLength(4);
  });
});

describe("Modern Manufacturing — party fields too wide for their half", () => {
  // jsdom has no layout: each field reports the width it needs on one line.
  const grid = (needs: number[][]) => {
    document.body.innerHTML = `<div class="mm-id-grid">${needs
      .map(
        (line) =>
          `<p class="mm-id-line">${line
            .map(() => '<span class="mm-id"></span>')
            .join("")}</p>`
      )
      .join("")}</div>`;
    const fields = [...document.querySelectorAll<HTMLElement>(".mm-id")];
    needs.flat().forEach((need, i) => {
      Object.defineProperty(fields[i], "clientWidth", { value: 200 });
      Object.defineProperty(fields[i], "scrollWidth", {
        get: () => (fields[i].closest(".is-measuring") ? need : 200),
      });
    });
    return [...document.querySelectorAll<HTMLElement>(".mm-id-line")];
  };

  it("keeps every line two fields across, in order, however wide a field is", () => {
    const lines = grid([[150, 180], [150, 260], [320]]);
    stackCrampedFields();
    expect(lines.map((line) => line.classList.contains("is-stacked"))).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("puts a line back side by side once its fields fit again", () => {
    const lines = grid([[150, 180]]);
    lines[0].classList.add("is-stacked");
    stackCrampedFields();
    expect(lines[0].classList.contains("is-stacked")).toBe(false);
  });
});

describe("Modern Manufacturing — summary tables as phone cards", () => {
  it("labels each cell with its column's headings, the Total row by its first cell", () => {
    document.body.innerHTML = `<div class="mm-widget-table"><table class="ceres-table">
      <thead><tr><th>Tax Rate</th><th colspan="2">IGST</th><th>Total</th></tr>
        <tr><th></th><th>Rate</th><th>Amount</th><th></th></tr></thead>
      <tbody><tr><td>18%</td><td>18%</td><td>$900.54</td><td>$900.54</td></tr></tbody>
      <tfoot><tr><td><strong>Total</strong></td><td></td><td>$900.54</td><td>$900.54</td></tr>
        <tr><td colspan="99" class="ceres-table-words">Total Tax In Words: NINE HUNDRED</td></tr></tfoot>
    </table></div>`;
    labelSummaryCells();
    const labels = (row: string) =>
      [...document.querySelectorAll(`${row} td`)].map((cell) =>
        cell.getAttribute("data-label")
      );
    expect(labels("tbody tr")).toEqual([
      "Tax Rate",
      "IGST Rate",
      "IGST Amount",
      "Total",
    ]);
    expect(labels("tfoot tr:first-child")).toEqual([
      null,
      "IGST Rate",
      "IGST Amount",
      "Total",
    ]);
    expect(labels("tfoot tr:last-child")).toEqual([null]);
    expect(
      document
        .querySelector("tfoot td:nth-child(2)")
        ?.hasAttribute("data-mm-empty")
    ).toBe(true);
  });

  it("marks figures and dates to stay on one line, never words", () => {
    document.body.innerHTML = `<div class="mm-widget-table"><table class="ceres-table">
      <thead><tr><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th></tr></thead>
      <tbody><tr><td>Sep 15, 2026</td><td>26-Dec-2025</td><td> $3.54 </td><td>Account Transfer</td><td>Bank account 0001</td></tr></tbody>
    </table></div>`;
    labelSummaryCells();
    expect(
      [...document.querySelectorAll("td")].map((cell) =>
        cell.hasAttribute("data-mm-figure")
      )
    ).toEqual([true, true, true, false, false]);
  });
});

describe("Modern Manufacturing — a browser's own print", () => {
  it("reads each media query as print would on the page", () => {
    expect(printMediaText("print", 718)).toBe("all");
    expect(printMediaText("print and (orientation: landscape)", 718)).toBe(
      "all and (orientation: landscape)"
    );
    expect(printMediaText("screen", 718)).toBe("not all");
    expect(printMediaText("screen and (width <= 640px)", 718)).toBe("not all");
    expect(printMediaText("(width <= 640px)", 718)).toBe("not all");
    expect(printMediaText("(width <= 640px)", 479)).toBe("all");
    expect(printMediaText("(max-width: 720px)", 718)).toBe("all");
    expect(printMediaText("(prefers-color-scheme: dark)", 718)).toBeUndefined();
  });

  it("switches the print rules on for one measurement and back", () => {
    document.head.innerHTML =
      "<style>@media print { .probe { color: red; } } @media screen { .probe { color: blue; } }</style>";
    const sheet = document.styleSheets[0];
    const media = () =>
      Array.from(sheet.cssRules).map(
        (rule) => (rule as CSSMediaRule).media.mediaText
      );
    const seen = withPrintRules(718, media);
    expect(seen).toEqual(["all", "not all"]);
    expect(media()).toEqual(["print", "screen"]);
    expect(() =>
      withPrintRules(718, () => {
        throw new Error("measure failed");
      })
    ).toThrow("measure failed");
    expect(media()).toEqual(["print", "screen"]);
  });

  it("prepares before printing, leaving the screen layout and its classes as they were", () => {
    document.head.innerHTML = "";
    document.body.innerHTML = `<div class="mm-doc" style="--mm-print-width: 714px;"><div class="mm-items-scroll"><table class="mm-items has-thumbnails is-cards"></table></div></div>`;
    prepareBrowserPrint();
    const doc = document.querySelector<HTMLElement>(".mm-doc");
    expect(doc?.style.width).toBe("");
    expect(document.querySelector(".mm-items")?.className).toBe(
      "mm-items has-thumbnails is-cards"
    );
  });
});

describe("Modern Manufacturing — the cross-origin stylesheet, readable without a request", () => {
  const crossOriginLink = () => {
    document.head.innerHTML = "";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://example.github.io/templates/modern-manufacturing-template/1.0.10/bundle.css";
    document.head.appendChild(link);
    const media = { mediaText: "" };
    Object.defineProperty(link, "sheet", {
      configurable: true,
      get: () => ({
        media,
        get cssRules() {
          throw new DOMException("cross-origin", "SecurityError");
        },
      }),
    });
    return media;
  };

  it("measures with the bundled CSS text switched on, then off again, leaving the link alone", () => {
    setModernManufacturingStylesheetText(
      '@import url("https://fonts.example/inter.css");\n@font-face { font-family: X; src: url(x.woff2); }\n@media print { .probe { color: red; } }'
    );
    const media = crossOriginLink();
    const seen = withReadableStylesheet(() => {
      const style = document.querySelector<HTMLStyleElement>(
        "style[data-mm-measure]"
      );
      return {
        enabled: style?.sheet?.disabled === false,
        text: style?.textContent ?? "",
        linkMedia: media.mediaText,
      };
    });
    expect(seen.enabled).toBe(true);
    expect(seen.linkMedia).toBe("");
    expect(seen.text).toContain("@media print");
    expect(seen.text).not.toContain("@import");
    expect(seen.text).not.toContain("@font-face");
    expect(media.mediaText).toBe("");
    expect(
      document.querySelector<HTMLStyleElement>("style[data-mm-measure]")?.sheet
        ?.disabled
    ).toBe(true);
  });

  it("never fetches the stylesheet (Refrens' PDF service answered that with a 404 page)", () => {
    crossOriginLink();
    const fetchSpy = jest.fn();
    (window as unknown as { fetch: unknown }).fetch = fetchSpy;
    withReadableStylesheet(() => undefined);
    document.dispatchEvent(new Event("load"));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("Modern Manufacturing — Lydia's live hide totals", () => {
  it("hides and shows the words line under the totals with the totals", () => {
    document.body.innerHTML = `<div class="mm-doc"><div data-ceres-subtotal></div>
      <p class="mm-words" data-ceres-total-in-words>Total (in words): TEN RUPEES ONLY</p></div>`;
    const line = () => document.querySelector(".mm-words") as HTMLElement;
    applyInvoiceUpdate({
      type: "lydia:invoice-update",
      fields: { hideTotals: true },
    });
    expect(line().classList.contains("is-hidden-by-totals")).toBe(true);
    applyInvoiceUpdate({
      type: "lydia:invoice-update",
      fields: { advanceOptions: { hideTotals: false } },
    });
    expect(line().classList.contains("is-hidden-by-totals")).toBe(false);
    // Other messages leave it alone.
    applyInvoiceUpdate({
      type: "lydia:template-update",
      fields: { hideTotals: true },
    });
    applyInvoiceUpdate({ type: "lydia:invoice-update", fields: {} });
    expect(line().classList.contains("is-hidden-by-totals")).toBe(false);
  });
});

describe("Modern Manufacturing — images that fail to load", () => {
  it("marks a failed image inside the document so it prints nothing", () => {
    registerModernManufacturingPrint();
    document.body.innerHTML = `<div class="mm-doc"><div class="mm-logo"><img class="mm-logo-image" alt="Seller"></div></div><img class="outside" alt="">`;
    const logo = document.querySelector(".mm-logo-image") as HTMLImageElement;
    const outside = document.querySelector(".outside") as HTMLImageElement;
    logo.dispatchEvent(new Event("error"));
    outside.dispatchEvent(new Event("error"));
    expect(logo.classList.contains("is-broken")).toBe(true);
    expect(outside.classList.contains("is-broken")).toBe(false);
  });
});
