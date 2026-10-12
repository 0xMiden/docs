// Rendered docs-shell regressions. Mobile coverage is viewport emulation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4187';
const dir = process.env.DOCS_UI_SCREENSHOT_DIR || '../qa-layout';
fs.mkdirSync(dir, {recursive: true});

(async () => {
  const browser = await chromium.launch();
  const results = [], measurements = [], errors = [], failedResponses = [];
  async function check(name, task) {
    try { await task(); results.push({name, passed: true}); console.log('PASS', name); }
    catch (e) { results.push({name, passed: false, error: e.message}); console.log('FAIL', name, e.message); }
  }
  async function ready(page) {
    await page.locator('.miden-search-trigger:not([disabled])').waitFor();
    await page.evaluate(() => document.fonts.ready);
  }
  async function chooseTheme(page, target) {
    let opened = false;
    for (let i = 0; i < 4 && await page.locator('html').getAttribute('data-theme-choice') !== target; i++) {
      let toggle = page.getByRole('button', {name: /Switch between dark and light mode/});
      if (!await toggle.isVisible()) {
        await page.getByRole('button', {name: 'Toggle navigation bar'}).click();
        opened = true;
        toggle = page.getByRole('button', {name: /Switch between dark and light mode/});
      }
      const previous = await page.locator('html').getAttribute('data-theme-choice');
      await toggle.click();
      await page.waitForFunction(value => document.documentElement.dataset.themeChoice !== value, previous);
    }
    assert.equal(await page.locator('html').getAttribute('data-theme-choice'), target);
    if (opened) await closeMenu(page);
  }
  async function closeMenu(page) {
    await page.getByRole('button', {name: 'Close navigation bar'}).click();
    await page.waitForFunction(() => document.querySelector('.navbar-sidebar').getBoundingClientRect().right <= 0);
  }
  async function primaryMenu(page) {
    await page.getByRole('button', {name: 'Toggle navigation bar'}).click();
    if (await page.locator('.navbar-sidebar__items--show-secondary').count()) {
      await page.getByRole('button', {name: /Back to main menu/}).click();
      await page.locator('.navbar-sidebar__items--show-secondary').waitFor({state:'detached'});
    }
  }
  async function whiteCta(page, width, mode) {
    if (width < 997) await primaryMenu(page);
    const link = page.locator(width < 997 ? '.navbar-sidebar .navbar-cta' : '.navbar__items--right .navbar-cta');
    try {
    assert.equal(await link.isVisible(), true, 'Start building must be visible in the active navigation surface');
    const states = [];
    for (const state of ['normal', 'hover', 'focus']) {
      if (state === 'hover') await link.hover();
      if (state === 'focus') { await page.mouse.move(width - 1, 999); await link.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); }
      const colors = await link.evaluate(el => ({
        text: getComputedStyle(el.querySelector('.navbar-cta__label')).color,
        arrow: getComputedStyle(el.querySelector('.navbar-cta__arrow')).color,
        background: getComputedStyle(el).backgroundColor,
        focusVisible: el.matches(':focus-visible'),
      }));
      assert.equal(colors.text, 'rgb(255, 255, 255)', JSON.stringify({state, colors}));
      assert.equal(colors.arrow, 'rgb(255, 255, 255)', JSON.stringify({state, colors}));
      if (state === 'focus') assert.equal(colors.focusVisible, true);
      states.push({state, ...colors});
    }
    measurements.push({width, mode, ctaStates: states});
    if (width < 997) {
      await page.screenshot({path: `${dir}/${width}-${mode}-menu.png`});
    }
    } finally { if (width < 997) await closeMenu(page); }
  }
  async function geometry(page) {
    return page.evaluate(() => {
      const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return {x:r.x, y:r.y, width:r.width, height:r.height, right:r.right}; };
      const textBox = el => { if (!el) return null; const range = document.createRange(); range.selectNodeContents(el); return box(range); };
      const sidebar = document.querySelector('.theme-doc-sidebar-container');
      const links = sidebar ? [...sidebar.querySelectorAll('.menu__link')].filter(el => el.getBoundingClientRect().height > 0) : [];
      return {
        navbar: box(document.querySelector('nav')), logo: box(document.querySelector('.navbar__logo')),
        toggle: box(document.querySelector('.navbar__toggle')), sidebar: box(sidebar),
        sidebarMenu: box(sidebar?.querySelector('.theme-doc-sidebar-menu')),
        sectionText: textBox(sidebar?.querySelector('.sidebar-section')),
        article: box(document.querySelector('.theme-doc-markdown')),
        intro: box(document.querySelector('main [class*=intro]')), heading: box(document.querySelector('h1')),
        sidebarLinks: links.map(el => ({text:el.textContent, ...box(el), scrollWidth:el.scrollWidth, clientWidth:el.clientWidth, wrap:getComputedStyle(el).overflowWrap})),
        overflow: document.documentElement.scrollWidth - innerWidth,
        docsShell: !!sidebar,
        theme: document.documentElement.dataset.theme,
      };
    });
  }
  function assertDocs(m, width) {
    assert.equal(m.docsShell, true); assert.equal(m.overflow, 0);
    if (width >= 997) {
      assert(Math.abs(m.logo.x - m.sectionText.x) <= .5, JSON.stringify({logo:m.logo, section:m.sectionText}));
      assert.equal(m.sidebar.width, width < 1200 ? 256 : 280);
      assert(Math.abs(m.article.x - m.sidebar.right - 24) <= .5, JSON.stringify({article:m.article, sidebar:m.sidebar}));
      assert(m.article.width >= 520, JSON.stringify(m.article));
      assert(m.sidebarMenu.x >= 16 && m.sidebarMenu.right <= m.sidebar.right - 15);
      for (const row of m.sidebarLinks) {
        assert(row.right <= m.sidebar.right - 15, JSON.stringify(row));
        assert(row.scrollWidth <= row.clientWidth + 1, JSON.stringify(row));
        assert.equal(row.wrap, 'anywhere', row.text);
      }
    } else {
      assert.equal(m.sidebar.width, 0); assert.equal(m.navbar.height, 64);
      assert.equal(m.logo.width, 64); assert.equal(m.logo.height, 20);
      assert(m.article.x >= 16 && m.article.right <= width - 15);
    }
  }
  try {
    for (const width of [1024, 1280, 1440, 390, 992, 996]) for (const mode of ['light', 'dark']) {
      const context = await browser.newContext({viewport:{width, height:1000}, colorScheme:mode, reducedMotion:'reduce'});
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
      page.on('response', r => {if (r.status() >= 400) failedResponses.push({status:r.status(), url:r.url()});});
      await page.goto(base + '/'); await ready(page); await chooseTheme(page, mode);
      await check(`${width}px ${mode} homepage gutter and white CTA states`, async () => {
        const m = await geometry(page); assert.equal(m.overflow, 0); assert.equal(m.docsShell, false);
        assert(Math.abs(m.heading.x - (width < 997 ? m.toggle.x : m.logo.x)) <= .5, JSON.stringify(m));
        measurements.push({width, mode, route:'home', geometry:m});
        await page.screenshot({path:`${dir}/${width}-${mode}-home.png`});
        await whiteCta(page, width, mode);
      });
      await check(`${width}px ${mode} stable/current header, Build and actual search navigation`, async () => {
        for (const version of ['stable', 'current']) {
          await page.getByLabel('Setup documentation version').selectOption(version);
          await page.waitForFunction(version => document.querySelector('.dsla-search-field').dataset.tags.includes(version === 'current' ? 'docs-default-current' : 'docs-default-0.17'), version);
          const href = await page.locator('.navbar__link').filter({hasText:/^Build$/}).getAttribute('href');
          assert.equal(href.includes('/next/'), version === 'current');
          const label = await page.locator('.navbar__item.dropdown > .navbar__link').first().textContent();
          assert(version === 'current' ? /next|unstable|current/i.test(label) : /0\.17/.test(label), label);
          await page.getByRole('button', {name:'Search documentation', exact:true}).click();
          await page.locator('.aa-DetachedContainer .aa-Input').fill('agentic');
          const first = page.locator('.aa-ItemLink[href*="/builder/agentic"]').first(); await first.waitFor();
          const found = await page.locator('.aa-ItemLink').evaluateAll(els => els.map(el=>el.getAttribute('href')).filter(href=>/\/(builder|reference)\//.test(href)));
          assert(found.length > 0); found.forEach(url=>assert.equal(url.includes('/next/'), version === 'current', url));
          await first.click(); await page.waitForURL(url=>url.pathname.includes('/builder/agentic'));
          await page.locator('.theme-doc-markdown').waitFor({state:'visible'});
          assert.equal(page.url().includes('/next/'), version === 'current');
          await page.goBack(); await page.getByRole('heading', {name:'Build your first Miden application.'}).waitFor(); await ready(page);
          if (width < 997) {await primaryMenu(page); await page.locator('.navbar-sidebar .menu__link').filter({hasText:/^Build$/}).click();}
          else await page.locator('.navbar__link').filter({hasText:/^Build$/}).click();
          await page.getByRole('heading', {name:'Build on Miden', exact:true}).waitFor();
          assert.equal(page.url().includes('/next/'), version === 'current');
          await page.goBack(); await page.getByRole('heading', {name:'Build your first Miden application.'}).waitFor(); await ready(page);
          measurements.push({width, mode, version, headerLabel:label.trim(), buildHref:href, searchResults:found});
        }
      });
      for (const version of ['stable', 'current']) await check(`${width}px ${mode} ${version} docs gutter, sidebar wrapping and content spacing`, async () => {
        await page.goto(base + (version === 'current' ? '/next' : '') + '/builder/get-started/'); await ready(page);
        await page.getByRole('heading', {name:'Quick Start', exact:true}).waitFor();
        const m = await geometry(page); assertDocs(m, width);
        measurements.push({width, mode, route:version + '-docs', geometry:m});
        await page.screenshot({path:`${dir}/${width}-${mode}-${version}-docs.png`});
        if (width >= 997) {
          const expand = page.locator('.theme-doc-sidebar-container button.menu__caret[aria-expanded=false]').first();
          if (await expand.count()) {const label = await expand.getAttribute('aria-label'); await expand.click(); const expanded = await geometry(page); assertDocs(expanded, width); measurements.push({width, mode, expandedCategory:label, geometry:expanded});}
        } else {
          await page.getByRole('button', {name:'Toggle navigation bar'}).click();
          const rows = await page.locator('.navbar-sidebar .theme-doc-sidebar-menu .menu__link').evaluateAll(els => els.filter(e=>e.getBoundingClientRect().height).map(e=>({text:e.textContent,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,wrap:getComputedStyle(e).overflowWrap})));
          assert(rows.length > 0); rows.forEach(row=>{assert(row.scrollWidth <= row.clientWidth + 1, JSON.stringify(row)); assert.equal(row.wrap,'anywhere');});
          await page.screenshot({path:`${dir}/${width}-${mode}-${version}-sidebar.png`}); await closeMenu(page);
        }
      });
      await check(`${width}px ${mode} docs theme transition preserves geometry`, async () => {
        const before = await geometry(page); await chooseTheme(page, mode === 'light' ? 'dark' : 'light');
        const after = await geometry(page); assertDocs(after, width);
        for (const key of ['logo','article','sidebar']) for (const field of ['x','width']) assert(Math.abs(before[key][field]-after[key][field]) <= .5, JSON.stringify({key,field,before:before[key],after:after[key]}));
        await chooseTheme(page, mode);
      });
      if (width < 997) await check(`${width}px ${mode} mobile CTA navigates and dismisses its menu`, async () => {
        for (const version of ['stable','current']) {
          await page.goto(base + (version === 'current' ? '/next' : '') + '/builder/agentic/'); await ready(page); await page.locator('.theme-doc-markdown').waitFor();
          await primaryMenu(page); const cta=page.locator('.navbar-sidebar .navbar-cta');
          assert.equal(await cta.isVisible(),true,'The mobile Start building entry must be visible');
          assert.equal((await cta.getAttribute('href')).includes('/next/'),version==='current');
          await cta.click(); await page.getByRole('heading',{name:'Quick Start',exact:true}).waitFor();
          await page.waitForFunction(()=>document.querySelector('.navbar-sidebar').getBoundingClientRect().right<=0);
          assert.equal(page.url().includes('/next/'),version==='current');
          // The existing menu callback must also close a same-route CTA click.
          await primaryMenu(page); await page.locator('.navbar-sidebar .navbar-cta').click();
          await page.waitForFunction(()=>document.querySelector('.navbar-sidebar').getBoundingClientRect().right<=0);
        }
      });
      await check(`${width}px ${mode} SPA landing/docs, back, reload and forward switch the correct shell`, async () => {
        await page.goto(base + '/'); await ready(page); await page.getByLabel('Setup documentation version').selectOption('current');
        await page.evaluate(() => { window.shellFrames=[]; const sample=()=>{const sidebar=document.querySelector('.theme-doc-sidebar-container');const logo=document.querySelector('.navbar__logo').getBoundingClientRect();window.shellFrames.push({docs:!!sidebar,logoX:logo.x,logoWidth:logo.width,navbarHeight:document.querySelector('nav').getBoundingClientRect().height});if(window.shellFrames.length<30)requestAnimationFrame(sample)};requestAnimationFrame(sample); });
        await page.getByRole('link', {name:'Start manually', exact:true}).click(); await ready(page); await page.getByRole('heading', {name:'Quick Start', exact:true}).waitFor(); assertDocs(await geometry(page), width);
        await page.waitForFunction(()=>window.shellFrames.length===30);const frames=await page.evaluate(()=>window.shellFrames);assert(frames.some(f=>f.docs));for(const f of frames.filter(f=>f.docs)) {if(width>=997)assert.equal(f.logoX,24,JSON.stringify(f));else{assert.equal(f.logoWidth,64);assert.equal(f.navbarHeight,64);}}measurements.push({width,mode,routeTransitionFrames:frames});
        await page.goBack(); await page.getByRole('heading', {name:'Build your first Miden application.'}).waitFor(); await ready(page); let m=await geometry(page); assert.equal(m.docsShell,false); assert(Math.abs(m.heading.x-(width<997?m.toggle.x:m.logo.x))<=.5);
        await page.goForward(); await page.getByRole('heading', {name:'Quick Start',exact:true}).waitFor(); await ready(page); await page.reload(); await ready(page); assertDocs(await geometry(page), width);
        assert((await page.locator('.dsla-search-field').getAttribute('data-tags')).includes('docs-default-current'));
      });
      await context.close();
    }
    await check('no page, hydration, console or HTTP errors', async () => {assert.deepEqual(errors,[]); assert.deepEqual(failedResponses,[]);});
  } finally {
    fs.writeFileSync(dir + '/layout-verification.json', JSON.stringify({base, sourceRevision:process.env.DOCS_UI_SOURCE_REVISION || 'uncommitted local follow-up', results, measurements, errors, failedResponses, coverage:'Chromium 1024/1280/1440/390 and 992/996 breakpoint viewports; light/dark and reduced-motion emulation. No physical-device coverage.'}, null, 2));
    await browser.close();
  }
  if (results.some(r => !r.passed)) process.exitCode = 1;
})().catch(e => {console.error(e); process.exitCode = 1;});
