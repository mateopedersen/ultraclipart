import { chromium, firefox, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base=process.env.BASE_URL??'http://127.0.0.1:4321';
const browserName=process.env.TEST_BROWSER??'chromium';
const launcher={chromium,firefox,webkit}[browserName];
if(!launcher)throw new Error('TEST_BROWSER must be chromium, firefox or webkit');
const browser=await launcher.launch({headless:true,...(process.env.BROWSER_BIN?{executablePath:process.env.BROWSER_BIN}:{})});
const dir=resolve('reports/site',browserName);mkdirSync(dir,{recursive:true});
const context=await browser.newContext();
const page=await context.newPage();
const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
const report={base,browser:browserName,browserVersion:browser.version(),date:new Date().toISOString(),status:'running',failure:'',states:[],checks:[],pageErrors};
const editor='/edit/pumpkin-curly-vine/';
async function readyEditor(){await page.locator('.uc-canvas [data-layer]').first().waitFor();}
const states=[
  {name:'01-home',url:'/'},
  {name:'02-categories',url:'/categories/'},
  {name:'03-search',url:'/search/?q=pumpkin',prepare:async()=>{await page.waitForFunction(()=>document.querySelector('#result-count')?.textContent?.startsWith('2 pilot'));}},
  {name:'04-topic',url:'/clipart/pumpkin/'},
  {name:'05-art-detail',url:'/art/pumpkin-curly-vine/'},
  {name:'06-editor',url:editor,prepare:readyEditor},
  {name:'07-recolor',url:editor,prepare:async()=>{await readyEditor();await page.locator('[data-panel=color]').click();await page.locator('[data-layer-picker]').selectOption({label:'Pumpkin skin'});await page.locator('[data-hex]').fill('#729bd6');await page.locator('[data-hex]').blur();await page.locator('[data-action=apply-color]').click();assert.ok(await page.locator('.uc-canvas [fill="#729bd6"]').count()>0);}},
  {name:'08-background-layers',url:editor,prepare:async()=>{await readyEditor();await page.locator('[data-panel=background]').click();await page.locator('.uc-editor [data-bg="#e8f1fa"]').click();await page.locator('[data-panel=layers]').click();await page.locator('[data-select]').first().click();}},
  {name:'09-black-white-print',url:`${editor}?mode=outline`,prepare:async()=>{await readyEditor();await page.locator('[data-panel=print]').click();await page.locator('[data-preset=outline]').click();await page.locator('[data-print-preview]').check();}},
  {name:'10-export',url:editor,prepare:async()=>{await readyEditor();await page.locator('[data-action=export]').click();await page.locator('[data-export-dialog]').waitFor({state:'visible'});}},
];
try{
  for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'tablet',width:768,height:1024},{name:'mobile',width:390,height:844}]){
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    for(const state of states){
      const response=await page.goto(`${base}${state.url}`);assert.ok([200,304].includes(response.status()),`${state.name} HTTP status ${response.status()}`);
      await page.evaluate(()=>document.fonts.ready);await state.prepare?.();
      const overflow=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));
      const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
      const result={state:state.name,viewport:viewport.name,width:viewport.width,url:state.url,overflow:overflow.document>overflow.viewport,violations:scan.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))};
      report.states.push(result);
      await page.screenshot({path:resolve(dir,`${state.name}-${viewport.name}.png`),fullPage:true});
      console.log(`${viewport.name} ${state.name}: ${result.violations.length} accessibility issues; overflow=${result.overflow}`);
    }
  }
  await page.setViewportSize({width:390,height:844});await page.goto(`${base}/`);
  await page.locator('.menu-button').click();assert.equal(await page.locator('.menu-button').getAttribute('aria-expanded'),'true');
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Categories',exact:true}).click();assert.ok(page.url().includes('/categories/'));report.checks.push('mobile navigation');
  await page.locator('[data-letter=K]').click();assert.equal(await page.locator('[data-letter=K]').getAttribute('aria-pressed'),'true');
  for(const value of await page.locator('[data-topic]:not([hidden])').allTextContents())assert.ok(value.toLowerCase().startsWith('k'));report.checks.push('category A-Z filtering');
  await page.goto(`${base}/art/pumpkin-curly-vine/`);await page.locator('[data-favorite]').click();await page.reload();assert.equal(await page.locator('[data-favorite]').getAttribute('aria-pressed'),'true');
  await page.goto(`${base}/favorites/`);assert.equal(await page.locator('#favorites .art-card:not([hidden])').count(),1);report.checks.push('favorite persistence');
  await page.goto(`${base}${editor}`);await readyEditor();await page.locator('[data-action=export]').click();
  for(let i=0;i<15;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('[data-export-dialog]').contains(document.activeElement)),true,'dialog focus must remain contained');}
  await page.keyboard.press('Escape');assert.equal(await page.locator('[data-export-dialog]').isVisible(),false);await page.waitForFunction(()=>document.querySelector('[data-action=export]')===document.activeElement,{},{timeout:5000});report.checks.push('dialog keyboard containment and focus return');
  await page.goto(`${base}/`);await page.keyboard.press('Tab');assert.equal(await page.locator('.skip').evaluate(el=>el===document.activeElement),true);report.checks.push('keyboard skip link');
  for(const url of ['/about/','/contact/','/license/','/terms/','/privacy/','/faq/','/accessibility/','/copyright/','/for-teachers/','/editorial-process/','/black-and-white/','/collections/']){
    const response=await page.goto(base+url);assert.ok([200,304].includes(response.status()),`${url} HTTP status ${response.status()}`);assert.equal(await page.locator('h1').count(),1,url);
    const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();report.states.push({state:url,viewport:'mobile',width:390,url,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),violations:scan.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
  }
  report.checks.push('all informational page types');
  const missing=await page.goto(`${base}/this-route-does-not-exist/`);assert.equal(missing.status(),404);report.checks.push('genuine 404 status');
  report.status=report.states.some(state=>state.overflow||state.violations.length)||pageErrors.length?'failed':'passed';
  writeFileSync(resolve(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,states:report.states.length,checks:report.checks,pageErrors},null,2));
  assert.equal(report.status,'passed','UI or accessibility issues remain; inspect reports/site');
}catch(error){report.status='failed';report.failure=error.message;writeFileSync(resolve(dir,'report.json'),JSON.stringify(report,null,2)+'\n');throw error;}
finally{await context.close();await browser.close();}
