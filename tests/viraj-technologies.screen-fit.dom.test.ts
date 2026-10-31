/**
 * @jest-environment jsdom
 */
import { fitItemsToScreen } from "../src/templates/viraj-technologies/helpers";

const media = (print: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: print && query === "print",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const mount = (extra = "") => {
  document.body.innerHTML = `<div class="vt-doc"><div class="vt-items-scroll"><table class="vt-items${extra}"><tbody><tr><td>1</td></tr></tbody></table></div></div>`;
  return document.querySelector<HTMLElement>(".vt-items") as HTMLElement;
};

// jsdom lays nothing out: the screen reads 0 px wide, a phone.
describe("Viraj Technologies — item table on a phone or tablet screen", () => {
  it("shows the items as cards on a phone", () => {
    media(false);
    const table = mount();
    fitItemsToScreen();
    expect(table.classList.contains("is-cards")).toBe(true);
  });

  it("keeps the table as it is in print", () => {
    media(true);
    const table = mount(" is-cards");
    fitItemsToScreen();
    expect(table.classList.contains("is-cards")).toBe(false);
    expect(table.classList.contains("is-grid")).toBe(false);
  });
});
