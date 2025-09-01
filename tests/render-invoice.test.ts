import tmpl from "../src/templates/invoice/template.hbs";

test("invoice template renders snapshot", () => {
  const html = tmpl({
    invoiceNumber: "INV-001",
    issueDate: "2025-08-01",
    customer: { name: "Alice" },
    items: [{ name: "Widget", quantity: 2, price: 50 }],
    total: 100
  });
  expect(html).toMatchSnapshot();
});
