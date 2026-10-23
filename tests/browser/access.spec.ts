import { test, expect } from '@playwright/test';
test('Team permission inspector preserves honest state and works on mobile', async ({page}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/team');
  await expect(page.getByRole('heading',{name:'Team & Access'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Invite member — backend required'})).toBeDisabled();
  await page.getByRole('button',{name:'Permissions',exact:true}).click();
  await page.getByLabel('Inspect role').selectOption('Sales');
  await page.getByLabel('Search permissions').fill('team.manage');
  await expect(page.locator('article').filter({hasText:'team.manage'})).toContainText('Owner only');
  await expect(page.getByText('Denied',{exact:true})).toBeVisible();
  await page.getByLabel('Inspect role').selectOption('Owner');
  await expect(page.getByText('Allowed',{exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('team-mobile.png'),fullPage:true});
  expect(errors).toEqual([]);
});
