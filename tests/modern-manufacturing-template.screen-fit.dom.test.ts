/**
 * @jest-environment jsdom
 */
import { fitItemsToScreen } from "../src/templates/modern-manufacturing-template/helpers";

const media = (print: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: print && query === "print",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const mount = (extra = "") => {
  document.body.innerHTML = `<div class="mm-doc"><div class="mm-items-scroll"><table class="mm-items${extra}"><tbody><tr><td>1</td></tr></tbody></table></div></div>`;
  return document.querySelector<HTMLElement>(".mm-items") as HTMLElement;
};

// jsdom lays nothing out: the screen reads 0 px wide, a phone.
describe("Modern Manufacturing — item table on a phone or tablet screen", () => {
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
