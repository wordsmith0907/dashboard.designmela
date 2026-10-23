import { parseFile } from "../src/lib/spreadsheet-parser";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {

  suggestMapping,
  validateRows,
  mappingErrors,
} from "../src/lib/lead-import";
import {
  newLead,
  duplicateMatches,
  filterLeads,
  scoreLead,
  safeFilterPreference,
} from "../src/lib/crm";
import { DemoProvider } from "../src/lib/provider";
import { quoteTotals } from "../src/lib/business";
import { validateWebsiteEvent } from "../src/lib/website-events";
const parse = (s: string) =>
  parseFile(new TextEncoder().encode(s).buffer, "demo.csv");
test("CSV parsing preserves quoted commas/newlines and rejects malformed input", () => {
  assert.equal(
    parse('Name,Notes\n"A, Example","One\nTwo"').rows[0][1],
    "One\nTwo",
  );
  assert.throws(() => parse('Name\n"unclosed'));
  assert.throws(() => parse("Name,Name\nA,B"));
});
test("XLS and XLSX parse real binary workbook formats", () => {
  for (const bookType of ["xlsx", "xls"] as const) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Name", "Email"],
        ["Example", "a@example.com"],
      ]),
    );
    const bytes = XLSX.write(wb, { type: "array", bookType });
    assert.equal(parseFile(bytes, `demo.${bookType}`).rows[0][0], "Example");
  }
});
test("mapping and invalid rows validate names contacts dates and numbers", () => {
  const p = parse(
    "Full name,Email,Estimated value,Next follow-up date\n,broken,-2,01/02/2026\nValid Demo,valid@example.com,10,2026-12-01",
  );
  const m = suggestMapping(p.headers);
  assert.deepEqual(mappingErrors(m), []);
  const rows = validateRows(p, m, []);
  assert.ok(rows[0].errors.length >= 4);
  assert.equal(rows[1].errors.length, 0);
  assert.equal(rows[1].lead.primarySource, "CSV/Excel Import");
});
test("duplicate normalization matches email then phone then name/company", () => {
  const a = {
    ...newLead(),
    name: "Example",
    company: "Studio",
    email: "A@example.com",
    phone: "+91 12345 67890",
  };
  assert.equal(
    duplicateMatches({ ...a, email: " a@EXAMPLE.com " }, [a])[0].reason,
    "Email",
  );
  assert.equal(
    duplicateMatches({ ...a, email: "", phone: "911234567890" }, [a])[0].reason,
    "Phone",
  );
  assert.equal(
    duplicateMatches({ ...a, email: "", phone: "", name: " EXAMPLE " }, [a])[0]
      .reason,
    "Name + company",
  );
});
test("import report, skip/update/separate and guarded undo preserve existing history", async () => {
  const p = new DemoProvider();
  const before = await p.load();
  const parsed = parse(
    "Name,Email,Primary source,Notes\nFictional Import,new@example.com,Referral,First note",
  );
  let rows = validateRows(parsed, suggestMapping(parsed.headers), before.leads);
  const request = {
    filename: "demo.csv",
    rows,
    strategy: "skip" as const,
    choices: {},
    targets: {},
    validOnly: true,
    confirmed: true,
  };
  const first = await p.importLeads(request);
  assert.equal(first.successfulRows, 1);
  rows = validateRows(
    parsed,
    suggestMapping(parsed.headers),
    (await p.load()).leads,
  );
  assert.equal((await p.importLeads({ ...request, rows })).skippedRows, 1);
  assert.equal(
    (await p.importLeads({ ...request, rows, strategy: "update" })).updatedRows,
    1,
  );
  assert.equal(
    (await p.importLeads({ ...request, rows, strategy: "separate" }))
      .successfulRows,
    1,
  );
  await p.undoLeadImport(first.id);
  assert.ok((await p.load()).leads.some((l) => l.id === first.rows[0].leadId));
});
test("unchanged import can be undone; later follow-ups protect records", async () => {
  const p = new DemoProvider();
  const parsed = parse("Name\nFictional New");
  const req = {
    filename: "demo.csv",
    rows: validateRows(parsed, suggestMapping(parsed.headers), []),
    strategy: "separate" as const,
    choices: {},
    targets: {},
    validOnly: true,
    confirmed: true,
  };
  const r = await p.importLeads(req);
  await p.undoLeadImport(r.id);
  assert.equal((await p.load()).imports[0].rows[0].status, "Undone");
  const r2 = await p.importLeads(req);
  const now = new Date().toISOString();
  await p.createFollowUp({
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    leadId: r2.rows[0].leadId,
    title: "Later work",
    dueAt: now,
    type: "Call",
    priority: "High",
    completedAt: "",
    reminderStatus: "In dashboard",
  });
  await p.undoLeadImport(r2.id);
  assert.equal((await p.load()).imports[1].rows[0].status, "Retained");
});
test("bulk actions are atomic and first touch survives source changes", async () => {
  const p = new DemoProvider();
  const l = (await p.load()).leads[0];
  await p.bulkLeads([l.id], { type: "source", value: "WhatsApp" });
  assert.equal((await p.load()).leads[0].firstTouchSource, l.firstTouchSource);
  await assert.rejects(() =>
    p.bulkLeads([l.id], { type: "stage", value: "Invalid" }),
  );
  assert.equal((await p.load()).leads[0].pipelineStage, l.pipelineStage);
});
test("filters combine and saved preferences exclude free text", () => {
  const l = { ...newLead(), name: "Example", temperature: "Hot" as const };
  assert.equal(
    filterLeads([l], { query: "Example", temperature: "Cold" }, []).length,
    0,
  );
  assert.deepEqual(
    safeFilterPreference({
      query: "Private Name",
      tags: "client",
      source: "Referral",
      scoreMin: "20",
    }),
    { source: "Referral", scoreMin: "20" },
  );
  assert.equal(filterLeads([], { query: "x" }, []).length, 0);
});
test("transparent scoring and manual overrides", () => {
  const l = {
    ...newLead(),
    name: "Demo",
    services: ["Web design"],
    estimatedValue: 100,
    email: "a@example.com",
  };
  assert.equal(scoreLead(l).score, 45);
  assert.equal(scoreLead({ ...l, manualScore: 90 }).score, 90);
});
test("quotes total explicit discount/tax and reject invalid amounts", () => {
  assert.equal(
    quoteTotals({
      items: [{ description: "Website", quantity: 2, price: 100 }],
      discount: 20,
      tax: 10,
    }).total,
    198,
  );
  assert.throws(() => quoteTotals({ items: [], discount: 20, tax: 0 }));
});
test("owner boundary and event privacy validation", async () => {
  await assert.rejects(() => new DemoProvider("not-owner").load());
  assert.throws(() =>
    validateWebsiteEvent({ event: "cta_clicked", email: "secret@example.com" }),
  );
  assert.equal(
    validateWebsiteEvent({
      event: "cta_clicked",
      ctaId: "hero_start_project",
      page: "/",
      sessionId: "anonymous-session-123",
      occurredAt: new Date().toISOString(),
    }).event,
    "cta_clicked",
  );
});
