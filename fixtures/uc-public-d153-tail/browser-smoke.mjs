import assert from 'node:assert/strict';
import {chromium,firefox,webkit} from '/deps/node_modules/@playwright/test/index.mjs';
assert.equal(process.env.PLAYWRIGHT_BROWSERS_PATH,'/ms-playwright');
for(const [name,engine] of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch();
 try{const page=await browser.newPage();await page.setContent('<p id="ready">offline-browser-ready</p>');assert.equal(await page.locator('#ready').innerText(),'offline-browser-ready');console.log('OFFLINE_BROWSER_SMOKE_PASS '+name);}
 finally{await browser.close();}
}
