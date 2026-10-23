import { test, expect } from "@playwright/test";
test("all routes render and capture desktop and mobile layouts", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.setViewportSize({ width: 1440, height: 1080 });
  for (const route of [
    "/",
    "/crm",
    "/audits",
    "/projects",
    "/content",
    "/posted",
    "/automations",
    "/settings",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByLabel("Loading dashboard")).toHaveCount(0);
    if (["/", "/crm", "/posted"].includes(route))
      await page.screenshot({
        path: testInfo.outputPath(`${route === "/" ? "today" : route.slice(1)}-desktop.png`),
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Today’s focus")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("today-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "CRM", exact: false }).first().click();
  await expect(page.locator("h1")).toContainText("Good relationships");
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(errors).toEqual([]);
});
test("audit and project forms validate and update records; search opens details", async ({
  page,
}) => {
  await page.goto("/audits");
  await page.getByRole("button", { name: "Add audit", exact: true }).click();
  await page.getByLabel("Audit title").fill("QA fictional audit");
  await page.getByLabel("Related lead").selectOption("lead-1");
  await page.getByLabel("Website URL").fill("https://example.com");
  await page.getByLabel("Audit type").fill("UX");
  await page.getByLabel("Requested date").fill("2026-10-01");
  await page.getByLabel("Due date").fill("2026-09-01");
  await page.getByRole("button", { name: "Save audit" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Due date",
  );
  await page.getByLabel("Due date").fill("2026-10-20");
  await page.getByRole("button", { name: "Save audit" }).click();
  await page
    .getByRole("button", { name: "QA fictional audit", exact: true })
    .click();
  await page.getByRole("button", { name: "Mark as sent" }).click();
  await expect(
    page.getByRole("dialog").getByText("Sent", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await page.getByLabel("Project name").fill("QA fictional project");
  await page.getByLabel("Start date").fill("2026-10-01");
  await page.getByLabel("Due date").fill("2026-10-30");
  await page.getByLabel("Progress (%)").fill("40");
  await page.getByLabel("Next action").fill("Review demo");
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "QA fictional project" }),
  ).toContainText("40%");
  await page.getByRole("button", { name: "Search your workspace" }).click();
  await page
    .getByLabel("Search leads, audits, projects and content")
    .fill("QA fictional project");
  await page
    .getByRole("link", { name: "Project QA fictional project" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("QA fictional project");
});
test("lead creation validation, editing, notes, follow-up and deletion", async ({
  page,
}) => {
  await page.goto("/crm");
  await page.getByRole("button", { name: "Add lead", exact: true }).click();
  await page.getByRole("button", { name: "Save lead" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Contact name").fill("QA Fictional");
  await page.getByLabel("Company", { exact: false }).fill("QA Example Studio");
  await page.getByLabel("Email", { exact: true }).fill("qa@example.com");
  await page.getByRole("button", { name: "Save lead" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "QA Fictional", exact: true }).click();
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("A fictional QA note");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(
    page.getByText("A fictional QA note", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create follow-up" }).click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("Follow up on demo");
  await page
    .getByLabel("Follow-up date & time (device time zone)", { exact: true })
    .fill("2026-01-01T09:00");
  await page.getByRole("button", { name: "Save follow-up" }).click();
  await expect(
    page.getByText("Follow up on demo", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByLabel("Pipeline stage").selectOption("Qualified");
  await page.getByRole("button", { name: "Save lead" }).click();
  const row = page.getByRole("row").filter({ hasText: "QA Fictional" });
  await expect(row).toContainText("Qualified");
  await page.getByRole("button", { name: "Archive QA Fictional" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "QA Fictional", exact: true }),
  ).toHaveCount(0);
});
test("publication requires metadata and appears in Posted without reload", async ({
  page,
}) => {
  await page.goto("/content");
  await page
    .getByRole("button", {
      name: "A fresh identity, a new chapter",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Record publication", exact: true })
    .click();
  await page.getByRole("button", { name: "Save publication" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByLabel("Live post URL", { exact: true })
    .fill("https://example.com/qa-publication");
  await page
    .getByLabel("Published date & time (device time zone)", { exact: true })
    .fill("2026-01-01T12:00");
  await page.getByRole("button", { name: "Save publication" }).click();
  await expect(
    page.getByRole("button", { name: "Record publication", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Posted", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "A fresh identity, a new chapter",
      exact: true,
    }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toBe("designmela-posted.csv");
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});
