import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4322';
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_BIN ? { executablePath:process.env.CHROMIUM_BIN } : {}) });
const evidence = resolve('reports/search');mkdirSync(evidence,{recursive:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const report={base,browser:'chromium',checks:[],accessibility:[],errors};
try {
  await page.goto(`${base}/search/?q=pumpkin`);
  await page.waitForFunction(()=>document.querySelector('#result-count')?.textContent?.startsWith('2 pilot'));
  assert.equal(await page.locator('#search-results .art-card:not([hidden])').count(),2);report.checks.push('subject search');
  await page.selectOption('#filter-style','outline');
  assert.equal(await page.locator('#search-results .art-card:not([hidden])').count(),1);
  assert.equal(await page.locator('#search-results .art-card:not([hidden])').getAttribute('data-id'),'pumpkin-botanical-outline');report.checks.push('real outline filter');
  await page.selectOption('#filter-orientation','portrait');
  await page.locator('#search-empty').waitFor({state:'visible'});report.checks.push('honest empty facet');
  await page.click('#clear-filters');
  assert.equal(await page.locator('#search-results .art-card:not([hidden])').count(),2);
  await page.fill('#search-query','');await page.locator('#catalog-search button').click();
  assert.equal(await page.locator('#search-results .art-card:not([hidden])').count(),8);
  await page.click('#next-page');
  assert.equal(await page.locator('#search-results .art-card:not([hidden])').count(),2);
  assert.ok(page.url().includes('page=2'));report.checks.push('pagination and URL');
  await page.goBack();
  await page.waitForFunction(()=>document.querySelector('#page-position')?.textContent==='Page 1 of 2');
  assert.equal(await page.locator('#search-results .art-card:not([hidden])').count(),8);report.checks.push('browser history');
  await page.selectOption('#search-sort','title');
  assert.ok(page.url().includes('sort=title'));report.checks.push('sorting');
  await page.fill('#search-query','<script>alert(1)</script>');await page.locator('#catalog-search button').click();
  await page.locator('#search-empty').waitFor({state:'visible'});assert.equal(await page.locator('#result-count script').count(),0);report.checks.push('query rendered as text');
  await page.fill('#search-query','black and white pumpkin');await page.locator('#catalog-search button').click();
  assert.equal(await page.locator('#search-results .art-card:not([hidden])').count(),1);
  await page.screenshot({path:resolve(evidence,'desktop.png'),fullPage:true});
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`horizontal overflow at ${width}px`);
    const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
    report.accessibility.push({width,violations:scan.violations.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>node.target)}))});
  }
  await page.screenshot({path:resolve(evidence,'mobile-320.png'),fullPage:true});
  assert.equal(errors.length,0,'browser errors');
  report.checks.push('mobile 390/320px overflow','no browser exceptions');
  report.status=report.accessibility.some(result=>result.violations.length)?'accessibility-issues':'passed';
  writeFileSync(resolve(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  assert.equal(report.status,'passed','Search accessibility issues remain');
} catch(error) {
  report.status='failed';report.failure=error.message;writeFileSync(resolve(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');throw error;
} finally {await browser.close();}
