import { expect } from '@playwright/test';

// The native radio is visually hidden inside its large, clickable label.
export async function chooseExportFormat(page, format) {
  const radio = page.locator(`[data-format][value="${format}"]`);
  await radio.locator('..').click();
  await expect(radio).toBeChecked();
}
