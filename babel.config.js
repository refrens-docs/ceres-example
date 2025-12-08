module.exports = {
  presets: [
    ["@babel/preset-env", {
      targets: { ie: "11" },
      useBuiltIns: "usage",
      corejs: 3,
      bugfixes: true,
      modules: false
    }],
    "@babel/preset-typescript"
  ],
  plugins: [
    ["@babel/plugin-transform-runtime", { corejs: false }]
  ]
};
