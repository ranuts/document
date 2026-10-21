import { expect, type Page } from '@playwright/test';

/** Enter the explicit source editor through its visible product control. */
export async function editArtifact(page: Page): Promise<void> {
  const workbench = page.locator('.agent-artifact-workbench');
  await expect(workbench).toBeVisible();
  if ((await workbench.getAttribute('data-mode')) !== 'edit') await workbench.locator('[data-action=edit]').click();
  await expect(workbench).toHaveAttribute('data-mode', 'edit');
}
