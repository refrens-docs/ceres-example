module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.(ts)$": ["babel-jest", { rootMode: "upward" }],
    "^.+\\.(hbs)$": "<rootDir>/tests/hbsTransform.js"
  },
  moduleFileExtensions: ["ts", "js", "json", "hbs"]
};
