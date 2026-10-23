import { test, expect } from "@playwright/test";
test("confirmed local CSV import, duplicate report and safe undo", async ({
  page,
}) => {
  await page.goto("/crm");
  await page.getByRole("button", { name: "Import Leads", exact: true }).click();
  await page
    .getByLabel("Choose file")
    .setInputFiles({
      name: "fictional.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Full name,Email,Company\nImport Example,import@example.com,Example Studio",
      ),
    });
  await expect(
    page.getByRole("button", { name: "Process file locally" }),
  ).toBeDisabled();
  await page.getByLabel("I confirm local processing").check();
  await page.getByRole("button", { name: "Process file locally" }).click();
  await expect(page.getByText("Preview · first 10 rows")).toBeVisible();
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("I confirm this fictional import").check();
  await page
    .getByRole("button", { name: "Confirm Import", exact: true })
    .click();
  await expect(
    page.getByText("1 created · 0 updated · 0 skipped · 0 failed"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Import Example", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Imports", exact: true }).click();
  await page.getByRole("button", { name: "Undo Import", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("Undone", { exact: true }).first()).toBeVisible();
  await page.getByRole('button', {name:'View report', exact:true}).click();
  await expect(page.getByText(/Undo results: 1 deleted · 0 preserved · 0 skipped · 0 failed/)).toBeVisible();
});
test("new navigation routes render with no runtime exceptions", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of ["/sales", "/tasks", "/clients", "/analytics"]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/crm");
  await page.screenshot({
    path: testInfo.outputPath("crm-v2-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
