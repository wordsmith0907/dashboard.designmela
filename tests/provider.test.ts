import { test } from "node:test";
import assert from "node:assert/strict";
import { DemoProvider } from "../src/lib/provider";
import { csv, safeUrl } from "../src/lib/format";
test("board changes cannot schedule content without a date", async () => {
  const p = new DemoProvider();
  const data = await p.load();
  await assert.rejects(() =>
    p.save("content", {
      ...data.content[0],
      status: "Scheduled",
      scheduledAt: "",
    }),
  );
  assert.equal((await p.load()).content[0].status, data.content[0].status);
});
test("demo mutations persist in a provider, stay isolated, and reset", async () => {
  const p = new DemoProvider();
  const other = new DemoProvider();
  const data = await p.load();
  const lead = { ...data.leads[0], name: "Changed demo name" };
  await p.save("leads", lead);
  assert.equal((await p.load()).leads[0].name, lead.name);
  assert.notEqual((await other.load()).leads[0].name, lead.name);
  await p.reset();
  assert.notEqual((await p.load()).leads[0].name, lead.name);
});
test("publication validates required details and atomically creates Posted history", async () => {
  const p = new DemoProvider();
  const data = await p.load();
  const id = data.content[0].id;
  await assert.rejects(() =>
    p.publish(id, {
      liveUrl: "javascript:alert(1)",
      publishedAt: new Date().toISOString(),
      platform: "Instagram",
    }),
  );
  assert.equal((await p.load()).posted.length, data.posted.length);
  await assert.rejects(() =>
    p.publish(id, {
      liveUrl: "https://example.com/post",
      publishedAt: "2999-01-01T00:00:00Z",
      platform: "Instagram",
    }),
  );
  await p.publish(id, {
    liveUrl: "https://example.com/post",
    publishedAt: new Date().toISOString(),
    platform: "LinkedIn",
  });
  const result = await p.load();
  assert.equal(result.content[0].status, "Published");
  assert.equal(result.content[0].platform, "LinkedIn");
  assert.equal(result.posted.length, data.posted.length + 1);
  assert.equal(result.posted.at(-1)?.metrics.reach, null);
  await assert.rejects(() =>
    p.publish(id, {
      liveUrl: "https://example.com/post",
      publishedAt: new Date().toISOString(),
      platform: "Instagram",
    }),
  );
});
test("generic content save cannot bypass required publication details", async () => {
  const p = new DemoProvider();
  const d = await p.load();
  await assert.rejects(() =>
    p.save("content", { ...d.content[0], status: "Published" }),
  );
});
test("deleting a lead removes notes, clears references, and retains project history", async () => {
  const p = new DemoProvider();
  const d = await p.load();
  await p.deleteLead("lead-1");
  const after = await p.load();
  assert.ok(!after.leads.some((l) => l.id === "lead-1"));
  assert.ok(!after.activities.some((a) => a.leadId === "lead-1"));
  assert.ok(!after.tasks.some((t) => t.leadId === "lead-1"));
  assert.equal(after.projects.length, d.projects.length);
  assert.equal(after.projects[0].leadId, "");
  assert.equal(after.audits[0].leadId, "");
});
test("load returns detached records, not mutable internal state", async () => {
  const p = new DemoProvider();
  const d = await p.load();
  d.leads.length = 0;
  assert.ok((await p.load()).leads.length > 0);
});
test("CSV quotes embedded delimiters and neutralises formula injection", () => {
  const out = csv([
    { name: '=HYPERLINK("x")', notes: 'line 1\nline 2, with "quotes"' },
  ]);
  assert.ok(out.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(out.includes('line 1\nline 2, with ""quotes""'));
  assert.equal(csv([]), "");
});
test("external URLs allow only HTTP and HTTPS", () => {
  assert.equal(safeUrl("https://example.com"), true);
  assert.equal(safeUrl("data:text/html,test"), false);
  assert.equal(safeUrl("/relative"), false);
});
