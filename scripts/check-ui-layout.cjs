// Run against a completed docs build served at PREVIEW_URL (default localhost:4187).
// Requires Playwright and its Chromium browser. PLAYWRIGHT_MODULE can point to an
// existing Playwright installation; DOCS_UI_SCREENSHOT_DIR optionally saves evidence.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4187';
const screenshotDir = process.env.DOCS_UI_SCREENSHOT_DIR;
const failures = [];
let passed = 0;
async function check(name, test) {
  try { await test(); passed++; console.log('PASS', name); }
  catch (error) { failures.push({ name, message: error.message }); console.log('FAIL', name, error.message); }
}
async function visit(page, route, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(base + route);
  await page.waitForSelector('.miden-search-trigger:not([disabled])');
  await page.evaluate(() => document.fonts.ready);
}

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    for (const theme of ['light', 'dark']) {
      await visit(page, '/', 1440);
      if (await page.locator('html').getAttribute('data-theme') !== theme) {
        await page.getByRole('button', { name: /Switch between dark and light mode/ }).click();
      }
      for (const width of [320, 375]) {
        for (const [route, text] of [
          ['/builder/get-started/setup/installation/', 'To install from source instead'],
          ['/builder/migration/account-changes/', 'AccountBuilder::with_auth_component was removed'],
        ]) {
          await check(`${theme} ${width}px callout content is not clipped: ${route}`, async () => {
            await visit(page, route, width);
            const callout = page.locator('.theme-admonition').filter({ hasText: text }).first();
            await callout.scrollIntoViewIfNeeded();
            const box = await callout.evaluate(el => {
              const body = el.querySelector('[class*="admonitionContent"]');
              const outer = el.getBoundingClientRect();
              const content = body.getBoundingClientRect();
              return { outerRight: outer.right, contentRight: content.right, contentWidth: body.clientWidth, contentScrollWidth: body.scrollWidth };
            });
            assert(box.contentRight <= box.outerRight - 10, JSON.stringify(box));
            assert(box.contentScrollWidth <= box.contentWidth + 1, JSON.stringify(box));
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
            if (screenshotDir && width === 320) {
              const routeName = route.split('/').filter(Boolean).pop();
              await page.screenshot({ path: `${screenshotDir}/sitewide-callout-${routeName}-${theme}.png` });
            }
          });
        }
      }
      for (const [route, tableIndex] of [
        ['/builder/migration/client-changes/', 0],
        ['/builder/migration/account-changes/', 2],
      ]) {
        await check(`${theme} desktop prose table does not need horizontal scroll: ${route}`, async () => {
          await visit(page, route, 1440);
          const table = page.locator('article table').nth(tableIndex);
          const box = await table.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth }));
          assert(box.scroll <= box.width + 1, JSON.stringify(box));
          await table.scrollIntoViewIfNeeded();
          if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/sitewide-table-${theme}-${tableIndex}-current.png` });
        });
      }
    }
    await check('Narrow code-heavy tables remain horizontally scrollable', async () => {
      await visit(page, '/builder/migration/account-changes/', 320);
      const boxes = await page.locator('article table').evaluateAll(tables => tables.map(el => ({ width: el.clientWidth, scroll: el.scrollWidth, overflow: getComputedStyle(el).overflowX })));
      assert(boxes.some(box => box.scroll > box.width + 1 && box.overflow === 'auto'), JSON.stringify(boxes));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
    });
    await check('Narrow long code blocks remain horizontally scrollable', async () => {
      await visit(page, '/builder/tutorials/recipes/web/create_deploy_tutorial/', 320);
      const boxes = await page.locator('article pre:visible').evaluateAll(blocks => blocks.map(el => ({ width: el.clientWidth, scroll: el.scrollWidth, overflow: getComputedStyle(el).overflowX })));
      assert(boxes.some(box => box.scroll > box.width + 1 && box.overflow === 'auto'), JSON.stringify(boxes));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
    });
    console.log(JSON.stringify({ passed, failed: failures.length, failures }, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
