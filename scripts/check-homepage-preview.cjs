// Production-preview checks. Install Playwright separately or point PLAYWRIGHT_MODULE
// at an existing installation. Mobile checks use viewports, not physical devices.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4187';
const evidence = process.env.DOCS_UI_SCREENSHOT_DIR || '../screenshots';
fs.mkdirSync(evidence, {recursive:true});
(async () => {
 const browser = await chromium.launch({headless:true});
 const context = await browser.newContext({viewport:{width:1440,height:1000}, reducedMotion:'reduce',colorScheme:'light'});
 const page = await context.newPage();
 const errors = []; const consoleErrors = []; const failedResponses=[]; const results=[];
 page.on('response', response => {if(response.status()>=400)failedResponses.push({status:response.status(),url:response.url()})});
 page.on('pageerror', error => errors.push(error.message));
 page.on('console', message => {if(message.type()==='error')consoleErrors.push(message.text())});
 await page.addInitScript(() => {window.__cls=0;new PerformanceObserver(list => {for(const e of list.getEntries())if(!e.hadRecentInput)window.__cls+=e.value}).observe({type:'layout-shift',buffered:true});});
 async function check(name, task) {try {await task();results.push({name,passed:true});console.log('PASS',name)}catch(e){results.push({name,passed:false,error:e.message});console.log('FAIL',name,e.message)}}
 async function home(){await page.goto(base+'/');await page.locator('.miden-search-trigger:not([disabled])').waitFor();await page.getByRole('heading',{name:'Build your first Miden application.'}).waitFor();await page.evaluate(()=>document.fonts.ready);}
 try {
 await home();
 await check('official button font, white label and accessible contrast',async()=>{
 const button=page.getByRole('link',{name:'Start manually',exact:true});
 const style=await button.evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor,fontSize:parseFloat(getComputedStyle(el).fontSize),fontFamily:getComputedStyle(el).fontFamily,radius:getComputedStyle(el).borderRadius,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
 assert.equal(style.color,'rgb(255, 255, 255)');assert(style.fontFamily.includes('Seasonmix'),JSON.stringify(style));assert.equal(style.radius,'10px');assert.equal(style.fontSize,20);
 function luminance(rgb){return rgb.match(/\d+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)}
 const contrast=1.05/(luminance(style.background)+.05);assert(contrast>=4.5,`Contrast ${contrast}`);console.log('CTA contrast',contrast.toFixed(2)+':1',style);
 });
 await check('account/proof illustration responds to keyboard and pointer',async()=>{
 const group=page.getByRole('group',{name:'Transaction flow stages'});const image=page.locator('main img').first();assert.equal(await image.evaluate(el=>getComputedStyle(el).visibility),'visible');assert.equal(await image.evaluate(el=>el.naturalWidth),1600);await group.getByRole('button',{name:'Prove',exact:true}).focus();await page.keyboard.press('Enter');await page.getByText('A proof attests to the state transition.',{exact:true}).waitFor();assert.equal(await group.getByRole('button',{name:'Prove',exact:true}).getAttribute('aria-pressed'),'true');await group.getByRole('button',{name:'Verify',exact:true}).click();await page.getByText('The network verifies and settles.',{exact:true}).waitFor();await group.getByRole('button',{name:'Execute',exact:true}).click();
 });
 await check('official logo, typography and palette match source roles',async()=>{
 const roles=await page.evaluate(()=>{const fields=el=>{const s=getComputedStyle(el);return {family:s.fontFamily,size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing,color:s.color,background:s.backgroundColor,radius:s.borderRadius,padding:s.padding}};const logo=document.querySelector('.navbar__logo [data-miden-logo]');return{heading:fields(document.querySelector('h1')),lead:fields(document.querySelector('main [class*=lead]')),secondary:fields(document.querySelector('main button[class*=secondary]')),page:fields(document.querySelector('main')),logo:{src:logo.getAttribute('data-source'),width:logo.getBoundingClientRect().width,height:logo.getBoundingClientRect().height},fonts:[...document.fonts].map(f=>({family:f.family,status:f.status}))}});
 assert(roles.heading.family.includes('Seasonmix'));assert.equal(roles.heading.size,'56px');assert.equal(roles.heading.weight,'600');assert.equal(roles.heading.lineHeight,'56px');assert.equal(roles.heading.letterSpacing,'-1.68px');assert.equal(roles.heading.color,'rgb(72, 72, 72)');
 assert(roles.lead.family.includes('Soehne Buch'));assert.equal(roles.lead.size,'20px');assert.equal(roles.lead.lineHeight,'28px');assert.equal(roles.page.background,'rgb(249, 249, 249)');
 assert.equal(roles.secondary.size,'20px');assert.equal(roles.secondary.radius,'10px');assert.equal(roles.secondary.padding,'18px 32px');assert.equal(roles.secondary.background,'rgb(255, 255, 255)');assert.equal(roles.logo.width,84);assert.equal(roles.logo.height,26);assert(roles.logo.src.endsWith('/brand/miden/miden-logo.svg'));
 assert(roles.fonts.some(f=>f.family==='Seasonmix'&&f.status==='loaded'));assert(roles.fonts.some(f=>f.family==='Soehne Buch'&&f.status==='loaded'));fs.writeFileSync(evidence+'/brand-role-comparison.json',JSON.stringify(roles,null,2));
 });
 await check('manual/agent toggles preserve page geometry at desktop and mobile widths',async()=>{
 const samples=[];
 for(const width of [1440,768,390,320]){
 await page.setViewportSize({width,height:1000});await home();
 for(const documentationVersion of ['stable','current']){
 await page.getByLabel('Setup documentation version').selectOption(documentationVersion);await page.evaluate(()=>new Promise(requestAnimationFrame));
 const geometry=()=>page.evaluate(()=>{const box=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y+scrollY,width:r.width,height:r.height}};return{page:box(document.querySelector('main')),bench:box(document.querySelector('[class*=workbench]')),panels:box(document.querySelector('[class*=panelStack]')),followingSection:box(document.querySelector('#model-heading')),sdk:box(document.querySelector('#sdk-title'))}});
 const reference=await geometry();
 for(let i=0;i<10;i++){
 const mode=i%2===0?'Agent-assisted':'Manual setup';await page.getByRole('tab',{name:mode,exact:true}).click();await page.evaluate(()=>new Promise(requestAnimationFrame));const actual=await geometry();samples.push({width,documentationVersion,mode,geometry:actual});
 for(const key of Object.keys(reference))for(const field of ['x','y','width','height'])assert(Math.abs(reference[key][field]-actual[key][field])<=.5,JSON.stringify({width,mode,key,field,before:reference[key][field],after:actual[key][field]}));
 assert.equal(await page.getByRole('tabpanel').count(),1);assert.equal(await page.locator('[role=tabpanel][aria-hidden=true]').evaluate(el=>el.inert),true);
 }
 }
 }
 fs.writeFileSync(evidence+'/tab-geometry.json',JSON.stringify(samples,null,2));await page.setViewportSize({width:1440,height:1000});await home();
 });
 await check('manual setup and draft agent entry',async()=>{await page.getByRole('button',{name:'Use an agent',exact:true}).click();await page.getByRole('tabpanel').getByText(/dedicated Build with an agent guide is in draft/).waitFor();assert.equal(await page.getByRole('tab',{name:'Agent-assisted'}).getAttribute('aria-selected'),'true');await page.keyboard.press('ArrowLeft');assert.equal(await page.getByRole('tab',{name:'Manual setup'}).getAttribute('aria-selected'),'true');});
 await check('keyboard focus is visible',async()=>{const tab=page.getByRole('tab',{name:'Manual setup'});await tab.focus();assert.equal(await tab.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');});
 await check('copy command reports success',async()=>{await context.grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'Copy installation command'}).click();await page.getByRole('status').getByText('Copied to clipboard',{exact:true}).waitFor();});
 await check('milestones reveal the corresponding guide',async()=>{await page.getByRole('button',{name:'3 Test',exact:true}).click();await page.getByRole('link',{name:'Read the test guide'}).waitFor();});
 await check('every homepage internal link resolves',async()=>{const links=await page.locator('main a[href]').evaluateAll(els=>els.map(el=>el.getAttribute('href')));for(const href of [...new Set(links)]){const response=await context.request.get(new URL(href,base).href);assert.equal(response.status(),200,href);assert(!(/Page Not Found/.test(await response.text())),href);}});
 await check('landing to docs, reload, back and forward',async()=>{await page.getByRole('link',{name:'Start manually',exact:true}).click();await page.getByRole('heading',{name:'Quick Start',exact:true}).waitFor();assert(page.url().includes('/builder/get-started'));await page.reload();await page.getByRole('heading',{name:'Quick Start',exact:true}).waitFor();await page.goBack();await page.getByRole('heading',{name:'Build your first Miden application.'}).waitFor();await page.goForward();await page.getByRole('heading',{name:'Quick Start',exact:true}).waitFor();});
 await home();
 await check('current-version links, navbar SPA navigation and reload retain preference',async()=>{await page.getByLabel('Setup documentation version').selectOption('current');const link=page.getByRole('link',{name:'Start manually',exact:true});assert((await link.getAttribute('href')).includes('/next/'));const currentLinks=await page.locator('main a[href]').evaluateAll(els=>els.map(el=>el.getAttribute('href')));for(const href of [...new Set(currentLinks)]){const response=await context.request.get(new URL(href,base).href);assert.equal(response.status(),200,href);assert(!(/Page Not Found/.test(await response.text())),href);}await page.reload();await page.locator('.miden-search-trigger:not([disabled])').waitFor();await page.waitForFunction(()=>document.querySelector('select[aria-label="Setup documentation version"]').value==='current');await page.evaluate(()=>window.__sameDocument=true);await page.locator('.navbar-cta').click();await page.getByRole('heading',{name:'Quick Start',exact:true}).waitFor();assert(page.url().includes('/next/'));assert.equal(await page.evaluate(()=>window.__sameDocument),true);await page.goBack();});
 await check('search opens, returns results and closes with Escape',async()=>{await page.locator('.miden-search-trigger:not([disabled])').waitFor();await page.getByRole('button',{name:'Search documentation',exact:true}).click();const input=page.locator('.aa-DetachedContainer .aa-Input');await input.fill('account');await page.locator('.aa-ItemLink').first().waitFor();await page.keyboard.press('Escape');await page.locator('.aa-DetachedContainer').waitFor({state:'detached'});await page.waitForFunction(()=>document.querySelector('.miden-search-trigger')===document.activeElement);assert.equal(await page.getByRole('button',{name:'Search documentation',exact:true}).evaluate(el=>el===document.activeElement),true);});
 await home();await page.getByLabel('Setup documentation version').selectOption('stable');
 await check('desktop navbar menus and version selector',async()=>{const version=page.locator('.navbar__item.dropdown').filter({hasText:/0\.17/}).first();await version.locator('.navbar__link').hover();await version.locator('.dropdown__menu').waitFor({state:'visible'});await page.getByRole('heading',{name:'Build your first Miden application.'}).hover();await page.locator('.navbar__link').filter({hasText:/^Build$/}).click();await page.getByRole('heading',{name:'Build on Miden',exact:true}).waitFor();await home();});
 await home();await page.screenshot({path:evidence+'/desktop-light.png',fullPage:true});
 await check('theme switches without navigation',async()=>{for(let i=0;i<3 && await page.locator('html').getAttribute('data-theme')!=='dark';i++)await page.getByRole('button',{name:/Switch between dark and light mode/}).click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert.equal(await page.locator('main').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(11, 13, 16)');await page.screenshot({path:evidence+'/desktop-dark.png',fullPage:true});});
 for(const width of [320,390,768]){
 await check(`${width}px viewport has no horizontal overflow`,async()=>{await page.setViewportSize({width,height:844});await home();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);});
 if(width===390){await page.screenshot({path:evidence+'/mobile-dark.png',fullPage:true});await page.getByRole('button',{name:'Toggle navigation bar'}).click();await page.getByRole('button',{name:/Switch between dark and light mode/}).click();await page.getByRole('button',{name:'Close navigation bar'}).click();await page.screenshot({path:evidence+'/mobile-light.png',fullPage:true});}
 }
 await page.setViewportSize({width:390,height:844});
 await check('mobile navbar opens and closes',async()=>{await page.getByRole('button',{name:'Toggle navigation bar'}).click();await page.locator('.navbar-sidebar').waitFor({state:'visible'});await page.getByRole('button',{name:'Close navigation bar'}).click();assert.equal(await page.locator('.navbar-sidebar').evaluate(el=>el.getBoundingClientRect().right<=0),true);});
 await check('reduced motion and layout-shift sample',async()=>{await home();const count=await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length);assert.equal(count,0);const cls=await page.evaluate(()=>window.__cls);assert(cls<=.1,`CLS sample ${cls}`);console.log('CLS sample',cls);});
 await check('no JavaScript or hydration errors',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors.filter(text=>/hydration|React error|ReferenceError|TypeError/i.test(text)),[]);});
 await check('no console or network failures',async()=>{assert.deepEqual(consoleErrors,[],JSON.stringify(failedResponses));});
 } finally {fs.writeFileSync(evidence+'/verification.json',JSON.stringify({base,results,errors,consoleErrors,failedResponses,coverage:'Chromium desktop and mobile viewports; reduced-motion emulation. No physical-device coverage.'},null,2));await browser.close();}
 if(results.some(result=>!result.passed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
