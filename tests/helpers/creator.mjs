// Follow the same disclosure and template controls available to a visitor.
export async function chooseVectorStarter(page, id) {
  const starter = page.locator(`[data-creator-template="${id}"]`);
  if (!(await starter.isVisible())) await page.locator('.studio-basic-starters > summary').click();
  await starter.click();
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
