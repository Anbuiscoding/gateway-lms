import { expect, test } from '@playwright/test';
import { NAV, type Role } from '../src/modules';

// Start the app first (npm run dev) and seed the demo data (npm run seed -w @gateway/api).
const ACCOUNTS: { role: Role; portal: 'student' | 'admin'; email: string }[] = [
  { role: 'STUDENT', portal: 'student', email: 'arun@gateway.local' },
  { role: 'TRAINER', portal: 'admin', email: 'priya@gateway.local' },
  { role: 'ADMIN', portal: 'admin', email: 'admin@gateway.local' },
  { role: 'SUPER_ADMIN', portal: 'admin', email: 'super@gateway.local' },
];

for (const a of ACCOUNTS) {
  test(`${a.role}: every module fits the screen, has a title and no broken links`, async ({ page }) => {
    const slugs = NAV[a.role].flatMap((g) => g.items.map((m) => m[1]));
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push('script error: ' + e.message));
    page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) problems.push(`${r.status()} ${r.url()}`); });

    await page.goto(`/auth/${a.portal}/login`);
    await page.getByLabel('Email address').fill(a.email);
    await page.getByLabel('Password').fill('Gateway@123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/$/);

    for (const slug of slugs) {
      await page.goto(slug === 'dashboard' ? '/' : '/' + slug);
      await expect(page.locator('main .content')).toBeVisible();
      await page.waitForTimeout(400);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (wide > 1) problems.push(`${slug}: page is ${wide}px wider than the screen`);
      const title = await page.title();
      if (!/Gateway LMS$/.test(title)) problems.push(`${slug}: unexpected title "${title}"`);
      const links = await page.$$eval('a[href^="/"]', (as) => as.map((x) => (x as HTMLAnchorElement).getAttribute('href') || ''));
      for (const href of links) {
        const first = href.split(/[/?#]/).filter(Boolean)[0] ?? 'dashboard';
        if (!['auth', ...slugs].includes(first)) problems.push(`${slug}: link to ${href} is not a page for this role`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}

test('an unknown address shows the 404 page', async ({ page }) => {
  await page.goto('/auth/student/login');
  await page.getByLabel('Email address').fill('arun@gateway.local');
  await page.getByLabel('Password').fill('Gateway@123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.goto('/this-page-does-not-exist');
  await expect(page.getByText('We could not find that page')).toBeVisible();
});
