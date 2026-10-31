/**
 * @jest-environment jsdom
 */

/* A viewer rendered before ToastUI loads shows the plain-text fallback, then upgrades. */
describe("markdown-viewer — fallback upgrade", () => {
  it("upgrades a fallback render once ToastUI has loaded", async () => {
    // jsdom has no innerText; the browser's replaces the element's content, as textContent does.
    Object.defineProperty(HTMLElement.prototype, "innerText", {
      configurable: true,
      get() {
        return this.textContent;
      },
      set(value: string) {
        this.textContent = value;
      },
    });
    const helpers: Record<string, (...args: any[]) => any> = {};
    (window as any).Handlebars = {
      registerHelper: (name: string, fn: (...args: any[]) => any) => {
        helpers[name] = fn;
      },
      registerPartial: () => undefined,
    };
    let loadManifest: (value: unknown) => void = () => undefined;
    (global as any).fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          loadManifest = resolve;
        })
    );

    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      require("../src/widgets/markdown-viewer");
    });

    const { elementId, payloadBase64 } = helpers.prepareMarkdownViewerData(
      "**Bold** first\n\nsecond",
      {}
    );
    document.body.innerHTML = `<div id="${elementId}" class="markdown-viewer-widget"><script type="application/json" data-md-viewer data-payload="${payloadBase64}"></script></div>`;
    const widget = document.getElementById(elementId) as HTMLElement;
    const flush = () =>
      new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    await flush();

    // ToastUI not there yet: plain text, the payload script gone.
    expect(widget.dataset.mvInitialized).toBe("fallback");
    expect(widget.querySelector("script")).toBeNull();
    expect(widget.style.whiteSpace).toBe("pre-wrap");

    const Editor = jest.fn(({ el, initialValue }) => {
      el.insertAdjacentHTML(
        "beforeend",
        `<div class="toastui-editor-contents">${initialValue}</div>`
      );
    });
    (window as any).toastui = { Editor };
    (window as any).DOMPurify = { sanitize: (value: string) => value };
    loadManifest({
      ok: true,
      json: () =>
        Promise.resolve({
          dompurify: { js: "dompurify.js" },
          "toastui-editor": { js: "toastui.js" },
        }),
    });
    await flush();
    await flush();

    expect(Editor).toHaveBeenCalledTimes(1);
    expect(Editor.mock.calls[0][0].initialValue).toContain("**Bold**");
    expect(widget.dataset.mvInitialized).toBe("true");
    expect(widget.children).toHaveLength(1);
    expect(widget.style.whiteSpace).toBe("");
  });
});
