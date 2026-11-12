/**
 * @jest-environment jsdom
 */
import {
  prepareBrowserPrint,
  printMediaText,
  withPrintRules,
} from "../src/templates/apex-engineering/helpers";

describe("Apex Engineering — a browser's own print", () => {
  it("reads each media query as print would on the page", () => {
    expect(printMediaText("print", 718)).toBe("all");
    expect(printMediaText("screen", 718)).toBe("not all");
    expect(printMediaText("screen and (width <= 720px)", 718)).toBe("not all");
    expect(printMediaText("(width <= 640px)", 718)).toBe("not all");
    expect(printMediaText("(width <= 640px)", 479)).toBe("all");
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
    expect(withPrintRules(718, media)).toEqual(["all", "not all"]);
    expect(media()).toEqual(["print", "screen"]);
    expect(() =>
      withPrintRules(718, () => {
        throw new Error("measure failed");
      })
    ).toThrow("measure failed");
    expect(media()).toEqual(["print", "screen"]);
  });

  it("prepares before printing, leaving the screen layout as it was", () => {
    document.head.innerHTML = "";
    document.body.innerHTML = `<div class="ax-doc" style="--ax-print-width: 714px;"><div class="ax-items-scroll"><table class="ax-items is-cards"></table></div></div>`;
    prepareBrowserPrint();
    expect(document.querySelector<HTMLElement>(".ax-doc")?.style.width).toBe(
      ""
    );
    expect(document.querySelector(".ax-items")?.className).toBe(
      "ax-items is-cards"
    );
  });
});
