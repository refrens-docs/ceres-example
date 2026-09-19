import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(repoRoot, "scripts", "validate-templates.mjs");

type FixtureFiles = Record<string, string>;

/**
 * Same shape as `validate-templates.test.ts`'s helper: a self-contained
 * fixture "repo" holding a copy of the script, so `repoRoot` inside the copy
 * resolves to the fixture rather than to this checkout. The node_modules
 * symlink is what lets the copied ESM script resolve `handlebars`.
 * @param files
 */
const createFixtureRepo = (files: FixtureFiles): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ceres-plugin-"));
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.copyFileSync(
    scriptPath,
    path.join(dir, "scripts", "validate-templates.mjs")
  );
  fs.symlinkSync(
    path.join(repoRoot, "node_modules"),
    path.join(dir, "node_modules"),
    "dir"
  );
  Object.entries(files).forEach(([relativePath, content]) => {
    const full = path.join(dir, relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  });
  return dir;
};

const cleanup = (dir: string): void =>
  fs.rmSync(dir, { recursive: true, force: true });

/**
 * `FlattenedInvoicePayload` is the validator's own default root name for a
 * template with no `CeresTemplateDataMapper` assignment, so a fixture using it
 * gets its fields resolved without declaring a mapper.
 * @param definitions
 */
const fixtureSchema = (definitions: Record<string, unknown>): string =>
  JSON.stringify(
    { $schema: "http://json-schema.org/draft-07/schema#", definitions },
    null,
    2
  );

/**
 * The plugin class intentionally lives in `webpack.config.js`, beside
 * `AssetManifestPlugin` and `CspMetaPlugin` — the house pattern this file's
 * subject follows. webpack validates the exported config against a strict
 * schema, so the class cannot also be hung off `module.exports` without
 * making the config invalid. The registered instance is therefore the seam:
 * finding it also proves step 2's registration actually happened.
 */
const loadPluginClass = (): new (options: { strict: boolean }) => {
  apply: (compiler: unknown) => void;
} => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const config = require("../webpack.config");
  const instance = (
    config.plugins as { constructor?: { name?: string } }[]
  ).find((p) => p?.constructor?.name === "TemplateValidationPlugin");
  if (!instance) {
    throw new Error(
      "TemplateValidationPlugin is not registered in webpack.config.js plugins[]"
    );
  }
  return instance.constructor as never;
};

type FakeCompilation = {
  errors: Error[];
  warnings: Error[];
  fileDependencies: Set<string>;
};

const newCompilation = (): FakeCompilation => ({
  errors: [],
  warnings: [],
  fileDependencies: new Set<string>(),
});

/**
 * Minimal stand-in for the parts of `compiler` the plugin touches. Returns a
 * `run` that fires the `thisCompilation` taps, so a test can drive a
 * compilation without booting webpack.
 * @param context
 */
const fakeCompiler = (context: string) => {
  const taps: ((compilation: FakeCompilation) => void)[] = [];
  return {
    compiler: {
      context,
      hooks: {
        thisCompilation: {
          tap: (_name: string, fn: (compilation: FakeCompilation) => void) =>
            taps.push(fn),
        },
      },
    },
    run: (compilation: FakeCompilation) =>
      taps.forEach((fn) => fn(compilation)),
  };
};

const compileFixture = (dir: string, strict: boolean): FakeCompilation => {
  const Plugin = loadPluginClass();
  const { compiler, run } = fakeCompiler(dir);
  new Plugin({ strict }).apply(compiler);
  const compilation = newCompilation();
  run(compilation);
  return compilation;
};

const messages = (entries: Error[]): string[] =>
  entries.map((e) => (typeof e === "string" ? e : e.message));

/**
 * Requiring `webpack.config.js` runs its semver auto-bump, which rewrites
 * `src/{templates,widgets}/*&#47;version.json` when a recorded digest is stale — a
 * side effect of the module's import, not of anything under test. A unit suite
 * must not leave the working tree dirty, so the contents are snapshotted and
 * put back. (`npm run build` performs the same bump; this only stops `npm test`
 * from doing it behind the developer's back.)
 * @param dir
 */
const versionFiles = (): string[] =>
  ["templates", "widgets"].flatMap((kind) => {
    const base = path.join(repoRoot, "src", kind);
    if (!fs.existsSync(base)) return [];
    return fs
      .readdirSync(base)
      .map((name) => path.join(base, name, "version.json"))
      .filter((file) => fs.existsSync(file));
  });

describe("TemplateValidationPlugin", () => {
  const snapshot = new Map<string, string>();

  beforeAll(() => {
    versionFiles().forEach((file) =>
      snapshot.set(file, fs.readFileSync(file, "utf8"))
    );
  });

  afterAll(() => {
    snapshot.forEach((content, file) => {
      if (fs.readFileSync(file, "utf8") !== content)
        fs.writeFileSync(file, content);
    });
  });

  it("S39: a template error reaches the compilation as an error", () => {
    const dir = createFixtureRepo({
      "src/templates/main/index.ts": `export {};\n`,
      "src/templates/main/template.hbs": `{{misspelledHelper x}}\n`,
    });
    try {
      const compilation = compileFixture(dir, false);

      const errors = messages(compilation.errors).filter((m) =>
        m.includes("misspelledHelper")
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("main/template.hbs");
      expect(errors[0]).toContain(":1:");
      expect(errors[0]).toContain("unknown-helper");

      expect(
        messages(compilation.warnings).filter((m) =>
          m.includes("misspelledHelper")
        )
      ).toHaveLength(0);
    } finally {
      cleanup(dir);
    }
  });

  it("S40: strict promotes unknown-field, and only the plugin's caller decides it", () => {
    const files = {
      "schemas/fixture.schema.json": fixtureSchema({
        FlattenedInvoicePayload: {
          type: "object",
          properties: { known: { type: "string" } },
        },
      }),
      "src/templates/main/index.ts": `export {};\n`,
      "src/templates/main/template.hbs": `{{known}} {{invoice.undeclaredField}}\n`,
    };
    const dir = createFixtureRepo(files);
    const templatePath = path.join(dir, "src/templates/main/template.hbs");
    try {
      const before = fs.readFileSync(templatePath, "utf8");

      const strict = compileFixture(dir, true);
      expect(
        messages(strict.errors).filter((m) => m.includes("undeclaredField"))
      ).toHaveLength(1);

      const lenient = compileFixture(dir, false);
      expect(
        messages(lenient.warnings).filter((m) => m.includes("undeclaredField"))
      ).toHaveLength(1);
      expect(lenient.errors).toHaveLength(0);

      // The fixture must be untouched between the two runs — the flag is the
      // only thing that differs.
      expect(fs.readFileSync(templatePath, "utf8")).toBe(before);
    } finally {
      cleanup(dir);
    }
  });

  it("S40b: watch passes strict, a plain build does not (the R13 wiring)", () => {
    const readStrict = (serve: string | undefined): boolean => {
      jest.resetModules();
      const previous = process.env.WEBPACK_SERVE;
      if (serve === undefined) delete process.env.WEBPACK_SERVE;
      else process.env.WEBPACK_SERVE = serve;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
        const config = require("../webpack.config");
        const instance = (
          config.plugins as {
            constructor?: { name?: string };
            strict?: boolean;
          }[]
        ).find((p) => p?.constructor?.name === "TemplateValidationPlugin");
        return Boolean(instance?.strict);
      } finally {
        if (previous === undefined) delete process.env.WEBPACK_SERVE;
        else process.env.WEBPACK_SERVE = previous;
      }
    };

    expect(readStrict("true")).toBe(true);
    expect(readStrict(undefined)).toBe(false);
  });

  it("S41: a failing validation still emits assets, and a fixed template clears", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const webpack = require("webpack");
    const Plugin = loadPluginClass();
    const dir = createFixtureRepo({
      "entry.js": `module.exports = 1;\n`,
      "src/templates/main/index.ts": `export {};\n`,
      "src/templates/main/template.hbs": `{{misspelledHelper x}}\n`,
    });
    const templatePath = path.join(dir, "src/templates/main/template.hbs");
    const bundlePath = path.join(dir, "out", "bundle.js");

    const compileOnce = (): Promise<{ hasErrors: boolean }> =>
      new Promise((resolve, reject) => {
        webpack(
          {
            mode: "development",
            context: dir,
            entry: path.join(dir, "entry.js"),
            output: { path: path.join(dir, "out"), filename: "bundle.js" },
            plugins: [new Plugin({ strict: false })],
          },
          (err: Error | null, stats: { hasErrors: () => boolean }) => {
            if (err) reject(err);
            else resolve({ hasErrors: stats.hasErrors() });
          }
        );
      });

    return (async () => {
      try {
        const broken = await compileOnce();
        expect(broken.hasErrors).toBe(true);
        // EC7: the whole point — a failed validation must not stop emission,
        // or the dev server has nothing to serve while you fix the template.
        expect(fs.existsSync(bundlePath)).toBe(true);

        fs.writeFileSync(templatePath, `{{! fixed }}\n`);
        const fixed = await compileOnce();
        expect(fixed.hasErrors).toBe(false);
        expect(fs.existsSync(bundlePath)).toBe(true);
      } finally {
        cleanup(dir);
      }
    })();
  }, 60000);

  it("S42: every schemas/*.json is registered as a file dependency", () => {
    const dir = createFixtureRepo({
      "schemas/fixture.schema.json": fixtureSchema({
        FlattenedInvoicePayload: { type: "object", properties: {} },
      }),
      "schemas/second.schema.json": fixtureSchema({
        Other: { type: "object", properties: {} },
      }),
      "src/templates/main/index.ts": `export {};\n`,
      "src/templates/main/template.hbs": `{{! nothing }}\n`,
    });
    try {
      const compilation = compileFixture(dir, false);
      const registered = [...compilation.fileDependencies];

      ["fixture.schema.json", "second.schema.json"].forEach((name) => {
        expect(registered).toContain(path.join(dir, "schemas", name));
      });
    } finally {
      cleanup(dir);
    }
  });

  it("S43: a repo with no schemas/ directory does not crash the plugin", () => {
    const dir = createFixtureRepo({
      "src/templates/main/index.ts": `export {};\n`,
      "src/templates/main/template.hbs": `{{invoice.someField}}\n`,
    });
    try {
      // Returning at all is half the assertion: EC9 is about the plugin not
      // throwing when there is no contract to resolve against.
      const compilation = compileFixture(dir, false);
      expect(fs.existsSync(path.join(dir, "schemas"))).toBe(false);

      // phase-4.md predicted `unknown-root-context` warnings here. That is not
      // what this validator does: with no schemas/ at all there is no contract,
      // so field checking is skipped entirely and it reports nothing at exit 0
      // (verified by running it directly against such a fixture). The
      // requirement EC9 actually states — "SHALL NOT crash the plugin or the
      // CI job" — is what is asserted, rather than a predicted diagnostic that
      // does not exist.
      const all = [
        ...messages(compilation.errors),
        ...messages(compilation.warnings),
      ];
      expect(
        all.filter((m) => m.includes("validate-templates failed"))
      ).toHaveLength(0);
      expect(compilation.errors).toHaveLength(0);

      // And a schemas-less repo still registers no phantom dependency.
      expect([...compilation.fileDependencies]).toHaveLength(0);
    } finally {
      cleanup(dir);
    }
  });
});
