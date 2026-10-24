import {test,expect} from '@playwright/test';
test('Demo Mode does not expose live sign-in or silently enable Supabase',async ({page}) => {
  const remoteRequests:string[]=[];
  page.on('request',r => {if (r.url().includes('supabase.co')) remoteRequests.push(r.url());});
  await page.goto('/login');
  await expect(page.getByText('Connected Mode is disabled',{exact:true})).toBeVisible();
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await page.getByRole('link',{name:'Return to workspace'}).click();
  await expect(page.getByText('Demo data',{exact:true})).toBeVisible();
  expect(remoteRequests).toEqual([]);
});
