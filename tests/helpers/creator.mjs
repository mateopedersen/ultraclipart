// Follow the same disclosure and template controls available to a visitor.
export async function chooseVectorStarter(page, id) {
  const starter = page.locator(`[data-creator-template="${id}"]`);
  const backToPage = page.locator('[data-wb-back-page]');
  // The editor is intentionally initialized when it nears the viewport. On narrow
  // screens the page copy can push it below the observer margin, so bring it into
  // view before waiting for its controls to become ready.
  await page.locator('.uc-editor').scrollIntoViewIfNeeded();
  // The creator initially opens the editor over the page. Wait for the editor
  // controller to finish loading and publish the actual focus state before
  // deciding whether to leave that workspace; otherwise a fast browser can
  // try to click the page controls while the canvas still covers them.
  await page.waitForFunction(
    () => {
      const root = document.querySelector('.uc-editor');
      const back = root?.querySelector('[data-wb-back-page]');
      return (
        root &&
        root.getAttribute('aria-busy') !== 'true' &&
        back &&
        back.getAttribute('aria-pressed') !== null
      );
    },
    null,
    { timeout: 60000 },
  );
  if ((await backToPage.getAttribute('aria-pressed')) === 'true') {
    await backToPage.click();
    await backToPage.waitFor({ state: 'visible' });
    await page.waitForFunction(
      () => document.querySelector('[data-wb-back-page]')?.getAttribute('aria-pressed') === 'false',
    );
  }
  if (!(await starter.isVisible())) await page.locator('.studio-basic-starters > summary').click();
  await starter.click();
  await page.waitForFunction(() => {
    const root = document.querySelector('.uc-editor');
    return root && !root.hasAttribute('aria-busy');
  });
}

export async function chooseSelectionTool(page, value) {
  await page.locator('[data-panel="region"]').click();
  const details = page.locator('details').filter({ has: page.locator('[data-smart-tool]') });
  if (!(await details.evaluate((element) => element.open)))
    await details.locator('summary').click();
  await page.locator('[data-smart-tool]').selectOption(value);
}

export async function chooseScene(page, id) {
  const card = page.locator(`[data-studio-scene="${id}"]`);
  for (let batch = 0; batch < 6 && !(await card.isVisible()); batch++) {
    const more = page.locator('[data-scene-more]');
    if (!(await more.isVisible())) break;
    await more.click();
  }
  await card.click();
}
