import fs from "fs";
import path from "path";
import HandlebarsRuntime from "handlebars/runtime";
import fixture from "./fixtures/viraj-technologies.json";
import { normalizeInvoiceTemplateState } from "../src/main/invoiceTemplateNormalization";
import template from "../src/templates/viraj-technologies/template.hbs";
import {
  buildVirajView,
  customFieldText,
  fieldPairs,
  foreignAmountInWords,
  mapDetails,
  mapPrint,
  registerVirajHelpers,
  summaryWords,
  withGstColumnLabels,
  withoutEmptyColumns,
} from "../src/templates/viraj-technologies/helpers";
import taxSummaryPartial from "../src/widgets/tax-summary/TaxSummaryTable.hbs";
import hsnSummaryPartial from "../src/widgets/hsn-summary/HsnSummaryTable.hbs";
import paymentTablePartial from "../src/widgets/payment-table/PaymentTable.hbs";
import brandingPartial from "../src/widgets/refrens-branding/RefrensBranding.hbs";
import ceresImagePartial from "../src/widgets/image/CeresImage.hbs";
import ceresImageGalleryPartial from "../src/widgets/image/CeresImageGallery.hbs";
import invoiceStatusPartial from "../src/widgets/invoice-status/InvoiceStatus.hbs";
import { computeTaxSummary } from "../src/widgets/tax-summary/utils";
import { computeHsnSummary } from "../src/widgets/hsn-summary/utils";
import { computePaymentColumns } from "../src/widgets/payment-table/utils";
import { prepareImageGallery } from "../src/widgets/image/utils";
import registerFormatCurrencyHelper from "../src/widgets/shared/registerFormatCurrencyHelper";
import registerTaxFlagHelpers from "../src/widgets/shared/registerTaxFlagHelpers";

type Json = Record<string, any>;

const TEMPLATE_DIR = path.join(
  __dirname,
  "../src/templates/viraj-technologies"
);

/* A fresh, mutable copy of the fixture's wrapped payload. */
const payload = (edit?: (invoice: Json, root: Json) => void): Json => {
  const copy = JSON.parse(JSON.stringify(fixture));
  if (edit) edit(copy.invoice, copy);
  return copy;
};

const state = (edit?: (invoice: Json, root: Json) => void): Json =>
  normalizeInvoiceTemplateState(payload(edit) as never) as unknown as Json;

const render = (edit?: (invoice: Json, root: Json) => void): string =>
  template(state(edit));

const view = (edit?: (invoice: Json, root: Json) => void) =>
  buildVirajView(state(edit));

/* The text of an element, tags dropped and spaces collapsed. */
const plain = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* The markup of the first <section data-section="…"> (to its closing tag). */
const section = (html: string, name: string): string => {
  const start = html.indexOf(`data-section="${name}"`);
  if (start < 0) return "";
  return html.slice(
    html.indexOf(">", start) + 1,
    html.indexOf("</section>", start)
  );
};

beforeAll(() => {
  registerVirajHelpers(HandlebarsRuntime);
  registerFormatCurrencyHelper(HandlebarsRuntime);
  registerTaxFlagHelpers(HandlebarsRuntime);

  HandlebarsRuntime.registerHelper(
    "formateShortDateWithOffset",
    (value: unknown) => `date(${String(value ?? "")})`
  );
  HandlebarsRuntime.registerHelper(
    "formatPhoneNumber",
    (value: unknown) => `tel(${String(value ?? "")})`
  );
  HandlebarsRuntime.registerHelper(
    "prepareMarkdownViewerData",
    (content: unknown) => ({ content })
  );
  HandlebarsRuntime.registerPartial(
    "MarkdownViewer",
    (context: { content?: string }) =>
      `<div class="md">${context.content}</div>`
  );
  HandlebarsRuntime.registerPartial("TaxSummaryTable", taxSummaryPartial);
  HandlebarsRuntime.registerHelper(
    "computeTaxSummary",
    (items: unknown, options: { hash?: Json }) =>
      computeTaxSummary(Array.isArray(items) ? items : [], {
        isIgst: !!options?.hash?.isIgst,
        isUtgst: !!options?.hash?.isUtgst,
      })
  );
  HandlebarsRuntime.registerPartial("HsnSummaryTable", hsnSummaryPartial);
  HandlebarsRuntime.registerHelper(
    "computeHsnSummary",
    (items: unknown, options: { hash?: Json }) =>
      computeHsnSummary(Array.isArray(items) ? items : [], {
        isIgst: !!options?.hash?.isIgst,
        isUtgst: !!options?.hash?.isUtgst,
      })
  );
  HandlebarsRuntime.registerHelper("amountInWords", () => "words");
  HandlebarsRuntime.registerPartial("PaymentTable", paymentTablePartial);
  HandlebarsRuntime.registerHelper(
    "computePaymentColumns",
    (payments: unknown, options: { hash?: Json }) =>
      computePaymentColumns(Array.isArray(payments) ? payments : [], {
        businessCurrency: options?.hash?.businessCurrency,
        currency: options?.hash?.currency,
      })
  );
  HandlebarsRuntime.registerPartial("RefrensBranding", brandingPartial);
  HandlebarsRuntime.registerPartial("CeresImage", ceresImagePartial);
  HandlebarsRuntime.registerPartial(
    "CeresImageGallery",
    ceresImageGalleryPartial
  );
  HandlebarsRuntime.registerHelper(
    "prepareImageGallery",
    (images: unknown, options: { hash?: Json }) =>
      prepareImageGallery(images as never, {
        variant: options?.hash?.variant,
        alt: options?.hash?.alt,
      })
  );
  HandlebarsRuntime.registerPartial("InvoiceStatus", invoiceStatusPartial);
  HandlebarsRuntime.registerHelper("computeInvoiceStatus", (invoice: Json) => ({
    tags: [
      {
        text: invoice?.status === "PAID" ? "Paid" : "Unpaid",
        finalClass: "invoice-tag",
      },
    ],
  }));
});

const css = (): string =>
  fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");

describe("Viraj Technologies template — layout", () => {
  it("lays the document out in the design's order", () => {
    const html = render((invoice) => {
      invoice.letterHead = "https://example.com/letterhead.png";
    });
    const order = [
      'data-section="title"',
      'data-section="letterhead"',
      'data-section="parties"',
      'data-section="items"',
      'data-section="additional"',
      'data-section="notes-bank"',
    ].map((hook) => html.indexOf(hook));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("titles the document with the document's own title", () => {
    expect(plain(section(render(), "title"))).toContain("Quotation");
    expect(css()).toMatch(/\.vt-title \{[^}]*text-transform: uppercase/);
  });

  it("places the letterhead just below the title, with no logo, rules or Billed By", () => {
    const html = render((invoice) => {
      invoice.logo = "https://example.com/logo.png";
      invoice.letterHead = "https://example.com/letterhead.png";
    });
    expect(html).not.toContain("vt-logo-image");
    expect(html).not.toContain("vt-header");
    const title = html.indexOf('data-section="title"');
    const letterhead = html.indexOf('data-section="letterhead"');
    expect(letterhead).toBeGreaterThan(title);
    expect(letterhead).toBeLessThan(html.indexOf('data-section="parties"'));
    [
      "400 Sample Nagar",
      "sales@example.com",
      "23AAAAA0000A1Z5",
      "MP00A0000000",
    ].forEach((value) => expect(plain(html)).not.toContain(value));
  });

  it("repeats the letterhead from the print frame only when it is on every page", () => {
    const every = render((invoice) => {
      invoice.letterHead = "https://example.com/letterhead.png";
    });
    expect(every).toContain("is-print-repeated");
    expect(every).toContain('data-ceres-page-policy="all"');
    const first = render((invoice) => {
      invoice.letterHead = "https://example.com/letterhead.png";
      invoice.template = { pdfOptions: { letterHeadOnFirstPage: true } };
    });
    expect(first).not.toContain("is-print-repeated");
    expect(first).toContain('data-ceres-page-policy="first"');
  });

  it("prints the buyer as To / Address, then its fields two to a row", () => {
    const html = render();
    const parties = plain(section(html, "parties"));
    expect(parties).toContain("To: Sample Internet Private Limited");
    expect(parties).toContain("Address : 301/302, 3rd Floor");
    expect(parties).toMatch(
      /Kind Attention: Purchase Head Mobile No: 9000000010 Contact Details: Stores, Gate 2 Sales Engineer: A. Sample/
    );
    expect(html.match(/class="vt-billing-fields"/g)).toHaveLength(2);
  });

  it("keeps an odd last buyer field's empty pair of cells", () => {
    const rows = fieldPairs([1, 2, 3]);
    expect(rows).toEqual([{ cells: [1, 2] }, { cells: [3, null] }]);
  });

  it("lists only the document's details in the details box", () => {
    const rows = mapDetails(state());
    expect(rows.map((row) => row.label)).toEqual([
      "Quotation No.",
      "Date",
      "Valid Till",
      "Reference",
    ]);
    expect(plain(section(render(), "parties"))).not.toContain(
      "quotes@example.com"
    );
  });

  it("prints the E-commerce Operator after the dates, its GSTIN in brackets", () => {
    const rows = mapDetails(
      state((invoice) => {
        invoice.ecommerceOperator = { name: "test", gstin: "24AAAAA0000A1Z5" };
      })
    );
    expect(rows.at(-1)).toMatchObject({
      label: "E-commerce Operator",
      value: "test (24AAAAA0000A1Z5)",
    });
    expect(
      mapDetails(
        state((invoice) => {
          invoice.ecommerceOperator = null;
        })
      ).map((row) => row.key)
    ).not.toContain("ecommerceOperator");
  });

  it("closes with the document's Contact Details as refrens.com words them, after the signature", () => {
    const html = render((invoice) => {
      invoice.signature = "https://example.com/sign.png";
    });
    expect(plain(section(html, "contact"))).toBe(
      "For any enquiry, reach out via email at quotes@example.com , call on tel(+91 9000000003)"
    );
    expect(html.indexOf('data-section="contact"')).toBeGreaterThan(
      html.indexOf('data-testid="signature"')
    );
    expect(
      render((invoice) => {
        delete invoice.contact;
      })
    ).not.toContain('data-section="contact"');
  });

  it("prints the item columns with their own labels, Sr. No. first", () => {
    const html = render();
    const start = html.indexOf('data-testid="items-header"');
    const head = plain(
      html.slice(html.indexOf(">", start) + 1, html.indexOf("</thead>", start))
    );
    expect(head).toBe(
      "Sr. No. Item Description Part No. HSN Code Moq. Price Each in Rs. Discount Discount Price Each in Rs."
    );
  });

  it("rows the totals as the design: label across the table, figure in the last column", () => {
    const html = render();
    const totals = section(html, "totals");
    expect(plain(totals)).toContain("Total Basics ₹52,400.00");
    // The tax row follows the document's tax view: "IGST" here (DEFAULT view).
    expect(plain(totals)).toContain("IGST ₹8,688.42");
    expect(plain(totals)).toContain("Grand Total (INR) ₹56,957.42");
    const { colspan } = view().table;
    expect(totals).toContain(`colspan="${colspan - 1}"`);
    expect(totals).not.toContain("vt-fill");
  });

  it("prints the column sums only when Show Totals Row is on", () => {
    expect(render()).not.toContain('data-testid="items-total"');
    expect(
      render((invoice) => {
        invoice.showTotalsRow = true;
      })
    ).toContain('data-testid="items-total"');
  });

  it("prints Additional Info as the design's Terms & Conditions grid", () => {
    const additional = section(render(), "additional");
    expect(plain(additional)).toMatch(
      /^Terms &amp; Conditions Taxes GST @18% EXTRA HSN Code As per item Validity 30 days P&amp;F/
    );
    expect(additional.match(/class="vt-grid-row"/g)).toHaveLength(5);
    // The odd last field keeps its empty pair of cells.
    expect(additional.match(/aria-hidden="true"/g)).toHaveLength(2);
  });

  it("titles the notes with the business's label and puts the bank details beside them", () => {
    const html = render();
    const row = section(html, "notes-bank");
    expect(plain(row)).toMatch(/^Declaration/);
    expect(plain(row)).toContain("Bank Details");
    expect(plain(row)).toContain("Account Number: 00000000000000");
    expect(plain(row)).toContain("Scan to pay via UPI");
    expect(plain(row)).toContain(
      "Maximum of 1 lakh can be transferred via UPI in a single day"
    );
    expect(row).toContain('data-testid="upi-qr"');
  });

  it("prints the document's terms in a panel of their own", () => {
    const html = render((invoice) => {
      invoice.terms = [{ label: "Payment Terms", terms: ["50% advance"] }];
    });
    expect(plain(section(html, "terms"))).toBe("Payment Terms 50% advance");
  });

  it("puts Shipped From, Shipped To and Transport in panels when the document has them", () => {
    expect(render()).not.toContain('data-section="shipping"');
    const html = render((invoice) => {
      invoice.shippedTo = {
        name: "Sample Warehouse",
        street: "Plot 7, Sample Estate",
        city: "Pune",
        state: "Maharashtra",
        country: "IN",
      };
      invoice.transportDetails = {
        transportMode: "ROAD",
        vehicleNumber: "MH12AB1234",
      };
    });
    const shipping = plain(section(html, "shipping"));
    expect(shipping).toContain("Shipped To Sample Warehouse");
    expect(shipping).toContain("MH12AB1234");
  });

  it("assembles a sparse document without failing", () => {
    const html = render((invoice) => {
      delete invoice.billedTo;
      delete invoice.customFooters;
      delete invoice.notes;
      delete invoice.bankAccount;
      delete invoice.upi;
      delete invoice.contact;
      delete invoice.customHeaders;
    });
    expect(html).toContain('data-section="items"');
    expect(html).not.toContain('data-section="additional"');
    expect(html).not.toContain('data-section="notes-bank"');
    expect(html).toContain("is-details-only");
  });
});

describe("Viraj Technologies template — as refrens.com prints real documents", () => {
  it("prints the details without a title, dates as Refrens does", () => {
    const parties = plain(section(render(), "parties"));
    expect(parties).not.toContain("Invoice Details");
    expect(parties).toContain("Date Oct 12, 2026");
  });

  it("names the state from the party's GST state code", () => {
    const html = render((invoice) => {
      invoice.billedTo.state = "Maharashtra";
      invoice.billedTo.gstState = "37";
    });
    expect(plain(section(html, "parties"))).toContain(
      "Bengaluru, Andhra Pradesh, India - 560035"
    );
  });

  it("boxes a purchase order's vendor (Order To)", () => {
    const html = render((invoice) => {
      invoice.billType = "PURCHASEORDER";
      invoice.customLabels.billedBy = "Order To";
    });
    expect(plain(section(html, "parties"))).toContain(
      "Order To: Sample Technologies"
    );
  });

  it("prints an expense's number as Purchase No", () => {
    const html = render((invoice) => {
      invoice.isExpenditure = true;
      invoice.expenseNumber = "EXP-0001";
    });
    expect(plain(section(html, "parties"))).toContain("Purchase No EXP-0001");
  });

  it("prints the inline HSN and unit on a line of their own under the name", () => {
    const html = render((invoice) => {
      invoice.advanceOptions.hsnView = "MERGE";
      invoice.advanceOptions.unitColumn = "IN_NAME";
      invoice.advanceOptions.showUnitInName = true;
      invoice.items[0].unit = "PCS";
    });
    expect(html).toContain(
      '<span class="vt-item-name">Industrial proximity sensor, 12 mm, PNP</span>'
    );
    expect(html).toMatch(
      /<span class="vt-item-codes">.*HSN\/SAC: 85365090<\/span>/
    );
    expect(plain(html)).not.toContain("(HSN/SAC");
  });

  it("prints a unit price as entered, amounts at the document's decimals", () => {
    const row = view().table.rows[0] as {
      cells: Array<{ key: string; value: string }>;
    };
    expect(row.cells.find((cell) => cell.key === "rate")?.value).toBe("₹1,450");
  });

  it("draws the UPI QR on INR documents only, the limit note only while unpaid", () => {
    expect(view().bank.upi?.qr).toBeTruthy();
    expect(
      view((invoice) => {
        invoice.currency = "USD";
      }).bank.upi?.qr
    ).toBe("");
    expect(
      view((invoice) => {
        invoice.status = "PAID";
      }).bank.upi?.note
    ).toBe("");
  });

  it("prints a choice field's options by label, in the options' order", () => {
    const html = render((invoice) => {
      invoice.billedTo.customFields.push({
        label: "Choice",
        dataType: "CHECKBOX",
        params: { showInInvoice: true },
        value: ["B", "A"],
        options: [
          { label: "First", value: "A" },
          { label: "Second", value: "B" },
        ],
      });
    });
    expect(plain(section(html, "parties"))).toContain("Choice: First, Second");
  });

  it("prints no GSTIN or PAN for a party abroad", () => {
    const html = render((invoice) => {
      invoice.billedTo.country = "AE";
      invoice.billedTo.gstin = "29AAAAA0000A1Z5";
    });
    expect(plain(section(html, "parties"))).not.toContain("29AAAAA0000A1Z5");
  });

  it("prints no bare GSTIN or PAN label, even with Show when Empty on", () => {
    const html = render((invoice) => {
      invoice.billedTo.gstin = "";
      invoice.billedTo.panNumber = "";
      invoice.owner = invoice.owner ?? {};
      invoice.owner.configuration = {
        ...(invoice.owner.configuration ?? {}),
        experimental: {
          fieldVisibility: {
            gst: { showWhenEmpty: true },
            pan: { showWhenEmpty: true },
          },
        },
      };
    });
    expect(plain(section(html, "parties"))).not.toMatch(/GSTIN|PAN:/);
  });

  it("lays the buyer's fields two to a row, from the left, on one grid", () => {
    const html = render();
    const parties = section(html, "parties");
    expect(parties).toContain('class="vt-billing-grid"');
    const { rows } = view().billing as { rows: Array<{ cells: unknown[] }> };
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => expect(row.cells).toHaveLength(2));
  });

  it("gives a full-width description a ruled row of its own, as Apex does", () => {
    const html = render((invoice) => {
      invoice.advanceOptions.showDescriptionInFullWidth = true;
      invoice.items[0].description = "Long description";
    });
    expect(html).toMatch(
      /<tr class="vt-detail-row"[^>]*data-ceres-description-row>\s*<td class="vt-col-serial"><\/td>\s*<td colspan=/
    );
    expect(css()).not.toMatch(/\.vt-detail-row > td \{[^}]*border-top: 0/);
  });

  it("puts the terms beside the bank when there are no notes, as the Declaration group", () => {
    const html = render((invoice) => {
      invoice.notes = "";
      invoice.terms = [
        { label: "Terms and Conditions", terms: ["Pay within 15 days"] },
      ];
    });
    expect(section(html, "notes-bank")).toContain("Pay within 15 days");
    expect(html.match(/Pay within 15 days/g)).toHaveLength(1);
  });

  it("prints the terms under the notes | bank group", () => {
    const html = render((invoice) => {
      invoice.notes = "Declaration text";
      invoice.terms = [
        { label: "Terms and Conditions", terms: ["Pay within 15 days"] },
      ];
    });
    expect(html.indexOf('data-section="terms"')).toBeGreaterThan(
      html.indexOf('data-section="notes-bank"')
    );
  });

  it("adds a Notes column to the payments when a payment has notes", () => {
    const pay = (notes: string) => ({
      paymentDate: "2026-06-06T00:00:00.000Z",
      paymentMethod: "ACCOUNT_TRANSFER",
      amount: 10,
      notes,
    });
    const html = render((invoice) => {
      invoice.allPayments = [pay(""), pay("The Additional Notes")];
    });
    const payments = plain(section(html, "payments"));
    expect(payments).toContain("Notes");
    expect(payments).toContain("The Additional Notes");
    expect(
      plain(
        section(
          render((invoice) => {
            invoice.allPayments = [pay("")];
          }),
          "payments"
        )
      )
    ).not.toContain("Notes");
  });

  it("names the place of supply from its GST code, as refrens.com does", () => {
    const html = render((invoice) => {
      invoice.placeOfSupply = "29";
      invoice.billedTo.gstState = "29";
      invoice.billedTo.state = "England";
      invoice.shippedTo = {
        ...(invoice.shippedTo ?? {}),
        name: "Site",
        state: "England",
        gstState: "29",
        country: "IN",
      };
    });
    expect(plain(html)).toContain("Karnataka (29)");
    expect(plain(html)).not.toContain("England (29)");
  });

  it("prints no document QR, only the e-invoice QR while an IRN is active", () => {
    const html = render((invoice) => {
      invoice.documentQr = JSON.stringify({ n: "QT-1" });
    });
    expect(html).not.toContain('data-ceres-field-container="documentQr"');
  });

  it("prints the active e-invoice QR in the IRN details, not in the details box", () => {
    const html = render((invoice) => {
      invoice.irn = { Irn: "abc123", AckNo: "1826", qr: "signed-qr-text" };
      invoice.qrCode = "https://example.com/irn-qr.png";
    });
    expect(section(html, "compliance")).toContain(
      'data-ceres-field="qrCode" src="https://example.com/irn-qr.png"'
    );
    expect(section(html, "parties")).not.toContain("irn-qr.png");
  });

  it("prints no 'For <business>' line over the signature", () => {
    const html = render((invoice) => {
      invoice.signature = "https://example.com/sign.png";
    });
    expect(html).toContain('data-testid="signature"');
    expect(plain(html)).not.toContain("For Sample Technologies");
  });
});

describe("Viraj Technologies template — rules from the TEST documents", () => {
  it("prints rates and flat discounts as entered, an empty discount as 0%", () => {
    const rows = view((invoice) => {
      invoice.items[0].rate = 180.5;
      invoice.items[1].discount = { amount: 50, discountType: "FIXED_AMOUNT" };
      invoice.items[2].discount = { discountType: "PERCENTAGE" };
    }).table.rows as Array<{ cells: Array<{ key: string; value: string }> }>;
    const cell = (row: number, key: string) =>
      rows[row].cells.find((c) => c.key === key)?.value;
    expect(cell(0, "rate")).toBe("₹180.5");
    expect(cell(1, "discount")).toBe("₹50");
    expect(cell(2, "discount")).toBe("0%");
  });

  it("labels the discount row without a rate", () => {
    expect(plain(section(render(), "totals"))).toContain("Discount ₹4,131.00");
  });

  it("keeps a business's Tax Rate heading as refrens.com prints it", () => {
    const fixed = withGstColumnLabels({
      invoice: {
        taxType: "INDIA",
        columns: [{ key: "gstRate", label: "Tax Rate" }],
      },
    }) as { invoice: { columns: Array<{ label: string }> } };
    expect(fixed.invoice.columns[0].label).toBe("TAX Rate");
  });

  it("prints no bank or UPI details on a delivery challan", () => {
    expect(
      view((invoice) => {
        invoice.billType = "DELIVERYCHALLAN";
      }).bank.show
    ).toBe(false);
  });

  it("writes amounts in words in the document's currency", () => {
    expect(foreignAmountInWords(12419.5, "HKD")).toBe(
      "Twelve Thousand Four Hundred Nineteen Dollars And Fifty Cents Only"
    );
    expect(foreignAmountInWords(1655, "USD")).toBe(
      "One Thousand Six Hundred Fifty Five Dollars Only"
    );
    expect(summaryWords(0.18, "INR")).toBe(
      "ZERO RUPEE AND EIGHTEEN PAISE ONLY"
    );
    expect(summaryWords(5400, "USD")).toBe(
      "FIVE THOUSAND FOUR HUNDRED DOLLARS ONLY"
    );
  });

  it("drops spacer columns from a table in the notes, keeping the rest as typed", () => {
    const notes = [
      "Thank you",
      "| Phone | 9000 |  | Terms | NET 30 |",
      "| --- | --- | --- | --- | --- |",
      "| Email | a@b.c |  | SO: | S1 |",
    ].join("\n");
    expect(withoutEmptyColumns(notes)).toBe(
      [
        "Thank you",
        "| Phone | 9000 | Terms | NET 30 |",
        "| --- | --- | --- | --- |",
        "| Email | a@b.c | SO: | S1 |",
      ].join("\n")
    );
  });

  it("drops empty rows and empty tables, in the notes and in item descriptions", () => {
    const empty = ["|  |  |", "| --- | --- |", "|  |  |", "|  |  |"].join("\n");
    expect(withoutEmptyColumns(`Specs\n${empty}`)).toBe("Specs");
    expect(
      withoutEmptyColumns(
        ["|  |  |", "| --- | --- |", "| Make | Siemens |", "|  |  |"].join("\n")
      )
    ).toBe(["| Make | Siemens |", "| --- | --- |"].join("\n"));
    const html = render((invoice) => {
      invoice.items[0].description = empty;
    });
    expect(html).not.toContain('class="vt-item-desc"');
  });

  it("groups a number custom field in the document's locale, as refrens.com does", () => {
    expect(customFieldText(34745216339)).toBe("34,74,52,16,339");
    expect(customFieldText(44353, undefined, "en-HK")).toBe("44,353");
    expect(customFieldText("123456")).toBe("123456");
  });

  it("prints a currency custom field as code and amount", () => {
    expect(customFieldText({ currency: "AED", amount: 200 })).toBe("AED 200");
  });

  it("adds a computed Sub total row after a group's items", () => {
    const rows = view((invoice) => {
      invoice.items.splice(1, 0, { name: "TEST group", group: true });
    }).table.rows as Array<{
      isGroupTotal?: boolean;
      name?: string;
      cells: Array<{ key: string; value: string }>;
    }>;
    const total = rows.find((row) => row.isGroupTotal);
    expect(total?.name).toBe("Sub total");
    expect(total?.cells.find((c) => c.key === "quantity")?.value).toBe("131");
  });
});

describe("Viraj Technologies template — files and CSS", () => {
  it("holds only the files the template rule allows", () => {
    expect(fs.readdirSync(TEMPLATE_DIR).sort()).toEqual([
      "helpers.ts",
      "index.ts",
      "samples.json",
      "styles.css",
      "template.hbs",
      "version.json",
    ]);
  });

  it("keeps the fixture's document values out of the source", () => {
    const source = ["template.hbs", "helpers.ts", "styles.css"]
      .map((file) => fs.readFileSync(path.join(TEMPLATE_DIR, file), "utf8"))
      .join("\n");
    [
      "Sample Internet",
      "Q-2026-0042",
      "Purchase Head",
      "GST @18% EXTRA",
    ].forEach((value) => expect(source).not.toContain(value));
  });

  it("scopes every rule to the document and uses no @page", () => {
    const sheet = css();
    expect(sheet.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/@page/);
    const selectors = sheet
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/@import[^;]+;/g, "")
      .match(/(^|})\s*([^{}@]+)\{/g) as string[];
    selectors
      .map((rule) =>
        rule
          .replace(/^}?\s*/, "")
          .replace(/\{$/, "")
          .trim()
      )
      .filter((rule) => rule && !/^(from|to|\d+%)$/.test(rule))
      .forEach((rule) => expect(rule).toMatch(/\.vt-|vt-doc|isDibella/));
  });

  it("draws the design's rules, fill and type", () => {
    const sheet = css();
    expect(sheet).toContain("--vt-rule: #95949f");
    expect(sheet).toContain("--vt-ink: #22272f");
    expect(sheet).toContain("--vt-font-size-base: 13px");
    expect(sheet).toContain("--vt-font-size-s: 13px");
    expect(sheet).toContain("--vt-font-size-xl: 24px");
    expect(sheet).toContain("--vt-pad: 6px");
    expect(sheet).not.toMatch(/padding: 8px/);
    expect(sheet).toMatch(
      /\.vt-items \{[^}]*border: var\(--vt-rule-width\) solid var\(--vt-rule\)/
    );
    expect(sheet).toMatch(/\.vt-upi-qr \{[^}]*width: 120px;[^}]*height: 120px/);
  });
});

describe("Viraj Technologies — description and note tables in print", () => {
  it("repeats a description or note table's headings on every page, breaking between its rows", () => {
    const source = fs.readFileSync(
      path.join(TEMPLATE_DIR, "styles.css"),
      "utf8"
    );
    const print = source.slice(source.indexOf("@media print"));
    expect(print).toMatch(
      /\.vt-doc :is\(\.vt-item-desc, \.vt-note-body\) \.toastui-editor-contents thead \{\s*display: table-header-group;/
    );
    expect(print).toMatch(
      /\.vt-doc :is\(\.vt-item-desc, \.vt-note-body\) \.toastui-editor-contents tr \{\s*break-inside: avoid;/
    );
  });
});

describe("Viraj Technologies — stretch to the page", () => {
  const stretched = (enabled: boolean, full: boolean, billType?: string) =>
    render((invoice, root) => {
      if (billType) invoice.billType = billType;
      invoice.owner = {
        ...(invoice.owner || {}),
        configuration: { experimental: { stretchInvoiceTable: enabled } },
      };
      root.pdfOptions = { ...(root.pdfOptions || {}), fullHeightTable: full };
      invoice.template = {
        ...(invoice.template || {}),
        pdfOptions: {
          ...(invoice.template?.pdfOptions || {}),
          fullHeightTable: full,
        },
      };
    });

  it("stretches the item table only when the business and the document ask, on every document type", () => {
    expect(stretched(true, true)).toContain("vt-doc is-stretch");
    expect(stretched(false, true)).not.toContain("is-stretch");
    expect(stretched(true, false)).not.toContain("is-stretch");
    expect(stretched(true, true, "DELIVERYCHALLAN")).toContain(
      "vt-doc is-stretch"
    );
  });

  it("sizes the stretch from the page area in CSS, not from the window", () => {
    const source = fs.readFileSync(
      path.join(TEMPLATE_DIR, "helpers.ts"),
      "utf8"
    );
    expect(source).toContain("calc(100vh / ");
    expect(source).not.toContain("height:100vh;");
  });

  it("caps the printed page at the paper's printable width, whatever the window", () => {
    const width = (pdfOptions: Record<string, unknown>) =>
      mapPrint({ pdfOptions }).printWidth;
    // A4 at 1 cm side margins: 794 - 76 - 4 px kept back.
    expect(width({})).toBe(714);
    expect(width({ xMargins: "0.5" })).toBe(751);
    expect(width({ landscape: true })).toBe(1042);
    const print = css().slice(css().indexOf("@media print"));
    expect(print).toMatch(/max-width: var\(--vt-print-width, none\);/);
    expect(render()).toContain("--vt-print-width: 714px;");
  });

  it("gives the page's printable height for the rows' page room, and never pre-shrinks text", () => {
    const print = (pdfOptions: Record<string, unknown>) =>
      mapPrint({ pdfOptions });
    // A4 portrait: 1123 - 76 px of 1 cm margins; A5 portrait 794 - 76; A4 landscape 794 - 76.
    expect(print({}).printHeight).toBe(1046);
    expect(print({ format: "a5" }).printHeight).toBe(718);
    expect(print({ landscape: true }).printHeight).toBe(718);
    expect(print({})).not.toHaveProperty("tableFit");
    expect(render()).toContain("--vt-print-height: 1046px;");
    expect(render()).not.toContain("--vt-table-fit");
    expect(css()).toMatch(
      /\.vt-items tr\.is-loose \{\s*break-before: auto !important;/
    );
  });

  it("prints bold at 600, never 700", () => {
    const source = css();
    expect(source).toContain("--vt-weight-strong: 600;");
    expect(source).toMatch(
      /\.vt-doc :is\(strong, b\),\s*\.vt-doc \.toastui-editor-contents :is\(strong, b\) \{\s*font-weight: var\(--vt-weight-heading\);/
    );
    expect(source).not.toMatch(/font-weight:\s*(700|bold)/);
  });
});

describe("Viraj Technologies — boxes split by a page break", () => {
  it("draws a split box's border on each page's piece", () => {
    const source = fs.readFileSync(
      path.join(TEMPLATE_DIR, "styles.css"),
      "utf8"
    );
    const print = source.slice(
      source.indexOf("A box split by a page break closes")
    );
    expect(print).toContain(
      ":is(.vt-panel, .vt-panel-body, .vt-billing, .vt-billing-fields, .vt-details)"
    );
    expect(print).toMatch(/box-decoration-break: clone;/);
  });

  it("closes each page's piece of the item table with a print-only footer row", () => {
    const html = render();
    expect(html).toMatch(
      /<tfoot class="vt-page-close" aria-hidden="true"><tr><td colspan="\d+"><\/td><\/tr><\/tfoot>\s*<\/table>/
    );
    const source = css();
    expect(source).toMatch(
      /\.vt-items > tfoot\.vt-page-close \{\s*display: none;/
    );
    expect(source).toMatch(
      /\.vt-doc \.vt-items > tfoot\.vt-page-close \{\s*display: table-footer-group;/
    );
  });

  it("leaves 4 px above and below a letterhead, on screen and on every printed page", () => {
    const source = css();
    expect(source).toMatch(
      /\.vt-doc:has\(\.vt-letterhead:not\(\.is-empty\)\) > \.vt-title-block \{\s*margin-bottom: calc\(4px - var\(--vt-section-gap\)\);/
    );
    expect(source).toMatch(
      /\.vt-page-body > \.vt-letterhead:not\(\.is-empty\) \{\s*margin-bottom: calc\(4px - var\(--vt-section-gap\)\);/
    );
    expect(source).toMatch(
      /\.vt-page-frame-header \.vt-letterhead:not\(\.is-empty\) \{\s*margin-bottom: 4px;/
    );
  });

  it("draws the UPI separator in the space a page break drops", () => {
    expect(css()).toMatch(
      /\.vt-bank-rows \+ \.vt-upi::before \{\s*position: absolute;\s*top: calc\(-1 \* var\(--vt-pad\)\);/
    );
  });
});
