// Follow the same disclosure and template controls available to a visitor.
export async function chooseVectorStarter(page, id) {
  const starter = page.locator(`[data-creator-template="${id}"]`);
  if (!(await starter.isVisible())) await page.locator('.studio-basic-starters > summary').click();
  await starter.click();
}
