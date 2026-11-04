/**
 * @jest-environment jsdom
 */
import fs from "fs";
import path from "path";
import {
  drawRiyalSigns,
  fitTotals,
  loadScriptFonts,
  placeFootersOnPageEdge,
  registerEcommerceLogo,
  respellTaxWords,
  flowAtHeight,
  flowFiller,
  flowBreakFills,
  prepareBrowserPrint,
  endBrowserPrint,
  stretchPrintRules,
  stretchItemTable,
} from "../src/templates/Ecommerce-Template/helpers";

const css = fs.readFileSync(
  path.join(__dirname, "../src/templates/Ecommerce-Template/styles.css"),
  "utf8"
);

describe("Ecommerce template — after the render, in the browser", () => {
  it("hides an image that fails to load, so no broken mark or alt text prints", () => {
    registerEcommerceLogo();
    document.body.innerHTML =
      '<div class="ec-doc"><img class="ec-signature-image" alt="Authorised Signatory" /></div><img id="outside" alt="" />';
    const signature = document.querySelector(
      ".ec-signature-image"
    ) as HTMLImageElement;
    signature.dispatchEvent(new Event("error"));
    document.getElementById("outside")?.dispatchEvent(new Event("error"));
    expect(signature.classList.contains("is-broken")).toBe(true);
    expect(
      document.getElementById("outside")?.classList.contains("is-broken")
    ).toBe(false);
    expect(css).toMatch(/\.ec-doc img\.is-broken \{\s*visibility: hidden;/);
  });

  it("asks for each script face as soon as its stylesheet is in, for the document's text", async () => {
    const calls: string[] = [];
    let ready = false;
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        load: (font: string, text: string) => {
          calls.push(`${font}|${text.includes("\u1799") ? "khmer" : ""}`);
          return Promise.resolve(ready ? [{}] : []);
        },
      },
    });
    document.body.innerHTML =
      '<div class="ec-doc" style="--ec-script-font: \'Noto Sans Khmer\';">\u1799\u17C1</div>';
    loadScriptFonts();
    await Promise.resolve();
    // No face yet (stylesheet still loading): asked again on the next run.
    ready = true;
    loadScriptFonts();
    await Promise.resolve();
    loadScriptFonts();
    expect(calls).toEqual([
      '400 16px "Noto Sans Khmer"|khmer',
      '600 16px "Noto Sans Khmer"|khmer',
      '700 16px "Noto Sans Khmer"|khmer',
      '400 16px "Noto Sans Khmer"|khmer',
      '600 16px "Noto Sans Khmer"|khmer',
      '700 16px "Noto Sans Khmer"|khmer',
    ]);
  });

  it("draws each Saudi riyal sign from an image, the empty box gone", () => {
    document.body.innerHTML =
      '<div class="ec-doc"><td>\u20C1 100.00</td><span>(\u20C1 18.00)</span></div>';
    drawRiyalSigns();
    expect(document.querySelectorAll(".ec-riyal")).toHaveLength(2);
    expect(document.body.textContent).toBe("\u20C1 100.00(\u20C1 18.00)");
    drawRiyalSigns();
    expect(document.querySelectorAll(".ec-riyal")).toHaveLength(2);
    expect(css).toMatch(
      /\.ec-doc \.ec-riyal \{[^}]*mask: url\("data:image\/png;base64,/
    );
  });

  it("rewrites the tax summaries' words in the document currency after the render", () => {
    document.body.innerHTML =
      '<div class="ec-doc" data-ec-currency="USD"><section data-section="tax-summary"><table>' +
      "<tr><td>Total</td><td>$5,400.18</td></tr>" +
      '<tr><td class="ceres-table-words">Total Tax In Words: FIVE THOUSAND RUPEES ONLY</td></tr>' +
      "</table></section></div>";
    respellTaxWords();
    expect(document.querySelector(".ceres-table-words")?.textContent).toBe(
      "Total Tax In Words: FIVE THOUSAND FOUR HUNDRED DOLLARS AND EIGHTEEN CENTS ONLY"
    );
  });
  it("keeps the totals' figures on the page when the table is cut at its edge", () => {
    // Five columns of 100 px from x = 0 in a 330 px box: columns 1-3 are wholly on the page.
    document.body.innerHTML =
      '<div class="box"><table class="ec-items"><thead><tr>' +
      "<th>Sr</th><th>Item</th><th>A</th><th>B</th><th>C</th></tr></thead>" +
      '<tbody><tr><th colspan="2">Total</th><td class="ec-fill"></td><td class="ec-fill"></td>' +
      '<td data-ec-fit><div class="ec-fig"><span>100</span></div></td></tr></tbody></table></div>';
    const rect = (left: number, width: number) =>
      ({
        left,
        right: left + width,
        width,
        top: 0,
        bottom: 10,
        height: 10,
      } as DOMRect);
    const box = document.querySelector(".box") as HTMLElement;
    box.getBoundingClientRect = () => rect(0, 330);
    document.querySelectorAll("thead th").forEach((cell, index) => {
      (cell as HTMLElement).getBoundingClientRect = () =>
        rect(index * 100, 100);
    });
    const row = () =>
      Array.from(document.querySelectorAll("tbody tr > *")).map((cell) =>
        cell.hasAttribute("data-ec-fit") ? "value" : cell.className || "label"
      );
    fitTotals();
    // The label spans columns 1-2, so the figure takes column 3 and both empty cells follow it.
    expect(row()).toEqual([
      "label",
      "value",
      "ec-fill ec-fill-after",
      "ec-fill ec-fill-after",
    ]);
    // Laid out again with room for every column, the figure is back in the last one.
    box.getBoundingClientRect = () => rect(0, 600);
    fitTotals();
    expect(row()).toEqual(["label", "ec-fill", "ec-fill", "value"]);
  });
  it("leaves the last-page footer after the content when the layout is not paginated", () => {
    // The PDF service switches to print media before it prints: forced breaks collapse, so a
    // page edge cannot be measured and the footer must not be pushed onto a page of its own.
    document.body.innerHTML =
      '<div class="ec-doc"><p>Content</p><div class="ec-letterhead-footer">Footer</div></div>';
    const footer = document.querySelector(
      ".ec-letterhead-footer"
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
    // The two collapsed breaks sit one flex gap apart.
    let marker = 0;
    const realCreate = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const element = realCreate(tag);
      const top = 480 + 20 * marker;
      marker += 1;
      element.getBoundingClientRect = () => ({ top } as DOMRect);
      return element;
    });
    placeFootersOnPageEdge();
    jest.restoreAllMocks();
    expect(footer.style.breakBefore).toBe("");
    expect(footer.style.marginTop).toBe("");
  });

  describe("the item table's stretch", () => {
    // Units a page break cannot split, laid on pages (Chrome 122's page heights): the filler
    // under the last item takes what is left of the page that item ends on.
    it("finds the room left on the page where the item table ends, on any page", () => {
      const layout = { head: 13, foot: 1, start: 0 };
      const units = [
        { top: 0, bottom: 600 }, // header and parties
        { top: 616, bottom: 900 }, // item 1
        { top: 900, bottom: 1300 }, // item 2: over the page's foot, moves to page 2
        { top: 1316, bottom: 2000 }, // the totals: too tall for page 2's rest, to page 3
      ];
      const room = flowFiller(units, 2, { ...layout, page: 1000 });
      // Item 2 on page 2 at 1013..1413; the totals move on to page 3: no filler, whose space
      // printed a piece of empty table above them (user, 2026-11-03).
      expect(room).toBeUndefined();
      // The page item 2 ends on is filled as a page break: 586 px under it, to page 2's foot.
      const grouped = units.map((unit, at) =>
        at === 1 || at === 2 ? { ...unit, group: 1 } : unit
      );
      const fills = flowBreakFills(grouped, 2, { ...layout, page: 1000 });
      expect(
        fills.map((fill) => [fill.unit, fill.room.c + fill.room.k * 1000])
      ).toEqual([
        [1, 99],
        [2, 586],
      ]);
      // A taller page: everything on page 1, the room after the totals.
      const tall = flowFiller(units, 2, { ...layout, page: 2500 });
      expect(tall && tall.c + tall.k * 2500).toBe(499);
    });

    it("lengthens the last item on every page the item table runs over", () => {
      const layout = { head: 13, foot: 1, start: 0 };
      const units = [
        { top: 0, bottom: 500 }, // header and parties
        { top: 500, bottom: 700, group: 1, first: true }, // item 1
        { top: 700, bottom: 1100, group: 1 }, // item 2: moves whole to page 2
        { top: 1100, bottom: 1800, group: 1 }, // item 3: moves whole to page 3
        { top: 1800, bottom: 1900, group: 1 }, // item 4, the last
        { top: 1900, bottom: 2000 }, // the totals
      ];
      const fills = flowBreakFills(units, 4, { ...layout, page: 1000 });
      const at = (fill: { room: { c: number; k: number } }) =>
        fill.room.c + fill.room.k * 1000;
      // Page 1 ends at 999: item 1 ends at 700, 299 px left. Page 2: item 2 at 1013..1413,
      // the page ends at 1999: 586 px left (item 3, 700 px tall, does not fit).
      expect(fills.map((fill) => fill.unit)).toEqual([1, 2]);
      expect(fills.map(at)).toEqual([299, 586]);
      // Not across a unit a page break cuts: after it nothing is known.
      const cut = units.map((unit, i) =>
        i === 2 ? { ...unit, fluid: true } : unit
      );
      expect(
        flowBreakFills(cut, 4, { ...layout, page: 1000 }).map((f) => f.unit)
      ).toEqual([]);
      // Not printed: Chrome prints narrow columns a line longer than measured, and the space
      // pushed items over (no break-fill rules, user's invoice MMS/IN/26-27/082).
      const printed = stretchPrintRules(units, 4, layout, 1, 16);
      expect(printed).not.toContain("ec-break-fill");
    });

    it("zeroes a browser print's top and bottom page margins, and only for its run", () => {
      document.body.innerHTML =
        '<div class="ec-doc" style="--ec-side-margin: 2"></div>';
      prepareBrowserPrint(() => undefined);
      expect(document.querySelector(".ec-doc.is-browser-print")).not.toBeNull();
      // The document's own side margins (xMargins), none above or below.
      expect(document.getElementById("ec-browser-page")?.textContent).toBe(
        "@page { margin: 0 2cm; }"
      );
      endBrowserPrint();
      expect(document.querySelector(".is-browser-print")).toBeNull();
      expect(document.getElementById("ec-browser-page")).toBeNull();
      // A Long PDF keeps its one page: no page rule.
      document.body.innerHTML = '<div class="ec-doc is-pageless"></div>';
      prepareBrowserPrint(() => undefined);
      expect(document.getElementById("ec-browser-page")).toBeNull();
    });

    it("sizes page-height images for the page they print on, not the window", () => {
      const units = [
        {
          top: 0,
          bottom: 300,
          images: [{ top: 10, measured: 270, natural: 600 }],
        },
        { top: 300, bottom: 400 },
      ];
      // 45% of a 1000 px page: 450 px, 180 px taller than the window's 270.
      const sized = flowAtHeight(units, 1000);
      expect(sized[0].bottom).toBe(480);
      expect(sized[1].top).toBe(480);
      // Never over 490 px, nor over the image's own height.
      expect(flowAtHeight(units, 2000)[0].bottom).toBe(520);
    });

    const realMatchMedia = window.matchMedia;
    const media = (print: boolean) => {
      window.matchMedia = ((query: string) =>
        ({
          matches: print && /print/.test(query),
          media: query,
        } as MediaQueryList)) as typeof window.matchMedia;
    };
    const sheet = (className: string, width: number, height: number) => {
      document.body.innerHTML =
        `<div class="${className}"><table class="ec-page-frame"><tbody><tr><td>` +
        '<div class="ec-frame"><div class="ec-items-scroll"><table class="ec-items"><tbody>' +
        '<tr class="ec-item-row"><td>1</td></tr>' +
        '<tr class="ec-filler"><td class="ec-col-serial"></td></tr>' +
        "</tbody></table></div></div></td></tr></tbody></table></div>";
      const doc = document.querySelector(".ec-doc") as HTMLElement;
      const at = (selector: string, top: number, bottom: number) => {
        const el = document.querySelector(selector) as HTMLElement;
        el.getBoundingClientRect = () =>
          ({ top, bottom, width, height: bottom - top } as DOMRect);
      };
      // The sheet's height without the filler: the filler's own height never counts.
      at(".ec-doc", 0, height);
      at(".ec-frame", 0, height);
      at(".ec-items-scroll", 100, 200);
      at(".ec-items", 100, 200);
      at(".ec-item-row", 100, 200);
      return {
        doc,
        filler: document.querySelector(".ec-filler") as HTMLElement,
      };
    };
    afterEach(() => {
      window.matchMedia = realMatchMedia;
    });

    it("fills a short document's preview to one A4 sheet, whatever the toggles", () => {
      media(false);
      // No is-stretch: the business toggle is off, the preview stretches all the same.
      const { doc, filler } = sheet("ec-doc", 1000, 900);
      stretchItemTable();
      expect(doc.classList.contains("is-screen-stretch")).toBe(true);
      expect(filler.style.getPropertyValue("--ec-screen-filler-height")).toBe(
        "514px"
      );
      // Measured again (resize, fonts, live update): the same height, never growing on itself.
      stretchItemTable();
      expect(filler.style.getPropertyValue("--ec-screen-filler-height")).toBe(
        "514px"
      );
      expect(filler.style.getPropertyValue("--ec-filler-height")).toBe("");
    });

    it("leaves a narrow or pageless preview as it is", () => {
      media(false);
      const cases: Array<[string, number, number]> = [
        ["ec-doc", 500, 300],
        ["ec-doc is-pageless", 1000, 300],
      ];
      cases.forEach(([className, width, height]) => {
        const { doc, filler } = sheet(className, width, height);
        stretchItemTable();
        expect(doc.classList.contains("is-screen-stretch")).toBe(false);
        expect(filler.style.getPropertyValue("--ec-screen-filler-height")).toBe(
          ""
        );
      });
    });

    it("stretches the printout by the business toggle alone, the preview's stretch off", () => {
      media(false);
      const off = sheet("ec-doc", 1000, 900);
      stretchItemTable();
      media(true);
      stretchItemTable();
      expect(off.doc.classList.contains("is-screen-stretch")).toBe(false);
      expect(off.filler.style.getPropertyValue("--ec-filler-height")).toBe("");
      const on = sheet("ec-doc is-stretch", 714, 900);
      stretchItemTable();
      // In print, the filler's height per page height: one media rule per range of heights,
      // 24 px kept back for the item row on the table's last page.
      const rules =
        document.getElementById("ec-stretch-pages")?.textContent || "";
      expect(rules).toMatch(
        /@media print and \(min-height: \d+px\) and \(max-height: [\d.]+px\) \{ \.ec-doc\.is-stretch \.ec-items \.ec-filler \{ --ec-filler-height: max\(0px, calc\(1 \* 100vh \/ 1 - 940px\)\); \} \}/
      );
      expect(on.filler.style.getPropertyValue("--ec-filler-height")).toBe("");
      // Back on screen, the preview's stretch returns.
      media(false);
      stretchItemTable();
      expect(on.doc.classList.contains("is-screen-stretch")).toBe(true);
      expect(on.filler.style.getPropertyValue("--ec-filler-height")).toBe("");
    });

    it("prints a document longer than a page as with the stretch off: no empty box under the last row", () => {
      // The filler's rules are as wide as it is tall, so at 0 px it draws nothing.
      expect(css).toMatch(
        /\.ec-doc\.is-stretch \.ec-items-scroll \.ec-items \.ec-filler > td \{\s*height: var\(--ec-filler-height, 0(?:px)?\);\s*border-inline-end-width: min\(\s*var\(--ec-rule-width\),\s*var\(--ec-filler-height, 0px\)\s*\);/
      );
      // No rule above it, either medium.
      expect(css).toMatch(
        /\.ec-doc \.ec-items-scroll \.ec-items \.ec-filler > td \{\s*padding-block: 0;\s*border-top: 0;/
      );
      // The column rules once drawn under a page's last row are gone.
      expect(css).not.toMatch(
        /--ec-column-rules|\.is-stretch \.ec-items-scroll \{/
      );
    });
  });
});
