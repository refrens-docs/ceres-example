/**
 * @jest-environment jsdom
 */
import {
  applyTemplateUpdate,
  fitPrintTable,
  loadScriptFont,
  resetItemsTableStretch,
  stretchItemsTable,
  footerEdgeGap,
  placeFootersOnPageEdge,
  registerModernManufacturingPrint,
  resetFootersOnPageEdge,
  respellTaxWords,
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

/*
 * fullHeightTable: the one printed page described as where it ends, where the document ends,
 * the last item row's height and the print zoom. A stretched row adds its extra height to the
 * document's end; `drift` adds more, as a placement that overflows the page would.
 */
interface StretchLayout {
  pageEnd: number;
  pageHeight: number;
  docEnd: number;
  rowHeight: number;
  scale?: number;
  drift?: number;
  hidden?: boolean;
  // The window's height (a 100vh probe), read when the print is not paginated.
  viewport?: number;
}

const mockStretchLayout = (layout: StretchLayout) => {
  const scale = layout.scale ?? 1;
  let markers = 0;
  const row = () =>
    document.querySelector<HTMLElement>(
      ".mm-items > tbody > tr:last-child"
    ) as HTMLElement;
  const added = () => {
    const set = parseFloat(row().style.height);
    return set ? set * scale - layout.rowHeight + (layout.drift ?? 0) : 0;
  };
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
      if (this.style.height === "100vh") return rect(0, layout.viewport ?? 0);
      if (this.classList.contains("mm-doc")) {
        return rect(0, layout.docEnd + added());
      }
      if (this === row()) return rect(0, layout.rowHeight);
      return rect(0, 0);
    });
  jest
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockImplementation(
      () => (layout.hidden ? [] : [rect(0, 1)]) as unknown as DOMRectList
    );
};

const page = (stretch = true, allowed = true) => {
  document.body.innerHTML = `<div class="mm-doc"${
    allowed ? " data-mm-stretch-allowed" : ""
  }${
    stretch ? " data-mm-stretch-table" : ""
  }><table class="mm-items"><tbody><tr><td>1</td></tr><tr><td>2</td></tr></tbody></table></div>`;
};

const lastRow = () =>
  document.querySelector<HTMLElement>(
    ".mm-items > tbody > tr:last-child"
  ) as HTMLElement;

describe("Modern Manufacturing — table stretched to fill the page", () => {
  const onePage = { pageEnd: 1000, pageHeight: 1000, docEnd: 700 };

  it("gives a one-page document's spare height to the last item row", () => {
    page();
    mockStretchLayout({ ...onePage, rowHeight: 40 });
    stretchItemsTable();
    // 1000 − 700 − 2 spare = 298 px more.
    expect(lastRow().style.height).toBe("338px");
    expect(lastRow().hasAttribute("data-mm-stretched")).toBe(true);
    // The measuring markers and probe are gone.
    expect(document.querySelector(".mm-doc")?.children.length).toBe(1);
  });

  it("writes the height in the row's own pixels under the print zoom", () => {
    page();
    mockStretchLayout({ ...onePage, rowHeight: 44, scale: 1.1 });
    stretchItemsTable();
    expect(parseFloat(lastRow().style.height)).toBeCloseTo(342 / 1.1, 5);
  });

  it("prints a longer document, or a full page, as it is", () => {
    page();
    mockStretchLayout({ ...onePage, pageEnd: 2000, rowHeight: 40 });
    stretchItemsTable();
    expect(lastRow().style.height).toBe("");

    jest.restoreAllMocks();
    mockStretchLayout({ ...onePage, docEnd: 999, rowHeight: 40 });
    stretchItemsTable();
    expect(lastRow().style.height).toBe("");

    jest.restoreAllMocks();
    mockStretchLayout({ ...onePage, pageHeight: 0, rowHeight: 40 });
    stretchItemsTable();
    expect(lastRow().style.height).toBe("");
  });

  it("leaves the page height to CSS where the print is not paginated (Refrens' PDF service)", () => {
    page();
    mockStretchLayout({ ...onePage, pageHeight: 0, rowHeight: 40 });
    // jsdom drops max() / calc() heights, so the assignment itself is read.
    const heights: string[] = [];
    jest
      .spyOn(CSSStyleDeclaration.prototype, "height", "set")
      .mockImplementation((value: string) => {
        // The row's height only, not the measuring markers' and probe's.
        if (value.startsWith("max(")) heights.push(value);
      });
    stretchItemsTable();
    // The row takes what the rest of the document (700 − 40 px) and 16 px leave of the page.
    expect(heights).toEqual(["max(40px, calc(100vh / 1 - 676px))"]);
    expect(lastRow().hasAttribute("data-mm-stretched")).toBe(true);

    // Under a print zoom above 1, the page in the row's pixels and more kept back.
    heights.length = 0;
    jest
      .spyOn(window, "getComputedStyle")
      .mockReturnValue({ zoom: "1.25" } as CSSStyleDeclaration);
    stretchItemsTable();
    expect(heights).toEqual(["max(40px, calc(100vh / 1.25 - 708px))"]);

    // Taller than the paper: more than a page, left as it is.
    heights.length = 0;
    (document.querySelector(".mm-doc") as HTMLElement).dataset.mmPaperHeight =
      "600";
    jest
      .spyOn(window, "getComputedStyle")
      .mockReturnValue({ zoom: "1" } as CSSStyleDeclaration);
    stretchItemsTable();
    expect(heights).toEqual([]);
    delete (document.querySelector(".mm-doc") as HTMLElement).dataset
      .mmPaperHeight;

    // A zoom that is not a number reads as 1.
    heights.length = 0;
    jest
      .spyOn(window, "getComputedStyle")
      .mockReturnValue({ zoom: "normal" } as CSSStyleDeclaration);
    stretchItemsTable();
    expect(heights).toEqual(["max(40px, calc(100vh / 1 - 676px))"]);
  });

  it("undoes a stretch that would push the page over", () => {
    page();
    mockStretchLayout({ ...onePage, rowHeight: 40, drift: 10 });
    stretchItemsTable();
    expect(lastRow().style.height).toBe("");
    expect(lastRow().hasAttribute("data-mm-stretched")).toBe(false);
  });

  it("leaves the table alone with the toggle off, or with no row drawn", () => {
    page(false);
    mockStretchLayout({ ...onePage, rowHeight: 40 });
    stretchItemsTable();
    expect(lastRow().style.height).toBe("");

    page();
    jest.restoreAllMocks();
    mockStretchLayout({ ...onePage, rowHeight: 40, hidden: true });
    stretchItemsTable();
    expect(lastRow().style.height).toBe("");

    document.body.innerHTML =
      '<div class="mm-doc" data-mm-stretch-table></div>';
    expect(() => stretchItemsTable()).not.toThrow();
  });

  it("clears the stretch after printing", () => {
    page();
    lastRow().style.height = "300px";
    lastRow().setAttribute("data-mm-stretched", "");
    resetItemsTableStretch();
    expect(lastRow().style.height).toBe("");
    expect(lastRow().hasAttribute("data-mm-stretched")).toBe(false);
  });

  it("follows Lydia's live toggle", () => {
    page(false);
    const doc = () => document.querySelector(".mm-doc") as HTMLElement;
    const update = (pdfOptions: unknown) =>
      applyTemplateUpdate({
        type: "lydia:template-update",
        template: { pdfOptions },
      });

    update({ fullHeightTable: true });
    expect(doc().hasAttribute("data-mm-stretch-table")).toBe(true);
    // Other print options leave it as it is.
    update({ zoomSize: "1.1" });
    expect(doc().hasAttribute("data-mm-stretch-table")).toBe(true);
    applyTemplateUpdate({ type: "lydia:print" });
    applyTemplateUpdate(null);
    expect(doc().hasAttribute("data-mm-stretch-table")).toBe(true);
    update({ fullHeightTable: "false" });
    expect(doc().hasAttribute("data-mm-stretch-table")).toBe(false);

    // A business without the stretch (experimental.stretchInvoiceTable) never turns it on.
    page(false, false);
    update({ fullHeightTable: true });
    expect(doc().hasAttribute("data-mm-stretch-table")).toBe(false);
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

  it("stretches before placing the footer when printing, and listens for the toggle", () => {
    type Listener = (event: { matches: boolean }) => void;
    const listeners: Listener[] = [];
    const state = window as typeof window & { mmPrintRegistered?: boolean };
    delete state.mmPrintRegistered;
    window.matchMedia = jest.fn().mockReturnValue({
      addEventListener: (_: string, listener: Listener) =>
        listeners.push(listener),
    });
    window.history.replaceState(null, "", "/");
    page(false);
    mockStretchLayout({ ...onePage, rowHeight: 40 });
    registerModernManufacturingPrint();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "lydia:template-update",
          template: { pdfOptions: { fullHeightTable: true } },
        },
      })
    );
    listeners[0]({ matches: true });
    expect(lastRow().style.height).toBe("338px");
    listeners[0]({ matches: false });
    expect(lastRow().style.height).toBe("");

    lastRow().style.height = "50px";
    lastRow().setAttribute("data-mm-stretched", "");
    window.dispatchEvent(new Event("afterprint"));
    expect(lastRow().style.height).toBe("");
  });
});

describe("Modern Manufacturing — a wide table fitted to the printed page", () => {
  // The table is `natural` px wide at full size and shrinks with --mm-print-fit; its box is `room`.
  const mockWidths = (natural: number, room: number) =>
    jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function measure(this: HTMLElement) {
        const fit =
          parseFloat(this.style.getPropertyValue("--mm-print-fit")) || 1;
        const width = this.classList.contains("mm-items")
          ? natural * fit
          : room;
        return { width } as DOMRect;
      });
  const printing = (matches: boolean) => {
    window.matchMedia = jest.fn().mockReturnValue({ matches });
  };
  const table = () =>
    document.querySelector<HTMLElement>(".mm-items") as HTMLElement;

  beforeEach(() => {
    document.body.innerHTML =
      '<div class="mm-items-scroll"><table class="mm-items"></table></div>';
  });

  it("tightens the padding, then shrinks the text just enough to fit", () => {
    printing(true);
    mockWidths(1000, 900);
    fitPrintTable();
    expect(table().classList.contains("is-print-fit")).toBe(true);
    expect(table().style.getPropertyValue("--mm-print-fit")).toBe("0.9");
  });

  it("never shrinks below 60 %", () => {
    printing(true);
    mockWidths(1000, 400);
    fitPrintTable();
    expect(table().style.getPropertyValue("--mm-print-fit")).toBe("0.6");
  });

  it("leaves a table that fits, the screen, and a detached table as they are", () => {
    printing(true);
    mockWidths(900, 900.4);
    fitPrintTable();
    expect(table().classList.contains("is-print-fit")).toBe(false);

    // Back on screen: the fit is cleared.
    table().classList.add("is-print-fit");
    table().style.setProperty("--mm-print-fit", "0.8");
    printing(false);
    fitPrintTable();
    expect(table().classList.contains("is-print-fit")).toBe(false);
    expect(table().style.getPropertyValue("--mm-print-fit")).toBe("");

    printing(true);
    const fragment = document.createDocumentFragment();
    const loose = document.createElement("table");
    loose.className = "mm-items";
    fragment.appendChild(loose);
    expect(() => fitPrintTable(fragment)).not.toThrow();
    expect(loose.classList.contains("is-print-fit")).toBe(false);

    (window as { matchMedia?: unknown }).matchMedia = undefined;
    fitPrintTable();
    expect(table().classList.contains("is-print-fit")).toBe(false);
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
  });
});
