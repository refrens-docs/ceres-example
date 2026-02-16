module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.(ts)$": ["babel-jest", { rootMode: "upward" }],
    "^.+\\.(hbs)$": "<rootDir>/tests/hbsTransform.js"
  },
  moduleFileExtensions: ["ts", "js", "json", "hbs"],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/tests/render-invoice.test.ts"],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/index.ts', // Exclude pure export files if needed, but per request keep it strict
  ],
};
