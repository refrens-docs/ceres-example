const Handlebars = require("handlebars");

module.exports = {
  process(src) {
    const compiled = Handlebars.precompile(src);
    // Jest's TransformedSource type declares { code }; the runtime still accepts a
    // bare string. Returning the object matches the declared contract.
    return {
      code: `
        const HandlebarsRuntime = require("handlebars/runtime");
        module.exports = HandlebarsRuntime.template(${compiled});
      `,
    };
  },
};
