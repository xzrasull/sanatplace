import { expect, type Page } from '@playwright/test';

// The site's own dropdown (CustomSelect): the button named after its label.
export const selectButton = (page: Page, label: string) =>
  page.getByRole('button', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`) });

// Opens the dropdown and clicks the option, as a person does.
export async function pick(page: Page, label: string, option: string) {
  await selectButton(page, label).click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}
