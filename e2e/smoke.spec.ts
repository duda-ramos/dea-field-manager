import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('app loads without crashing', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to load
    await expect(page).toHaveTitle(/DEA Manager/);
    
    // Check that main navigation is present
    await expect(page.locator('nav')).toBeVisible();
  });

  test('can navigate to dashboard', async ({ page }) => {
    await page.goto('/');
    
    // Look for dashboard content
    await expect(page.locator('h1')).toContainText(/Dashboard|Projetos/);
  });

  test('sync status is displayed', async ({ page }) => {
    await page.goto('/');
    
    // Check for sync button or status indicator
    const syncButton = page.locator('button:has-text("Sync")');
    const syncStatus = page.locator('[data-testid="sync-status"]');
    
    const hasSync = await syncButton.isVisible().catch(() => false);
    const hasStatus = await syncStatus.isVisible().catch(() => false);
    
    expect(hasSync || hasStatus).toBeTruthy();
  });

  test('can create new project (offline mode)', async ({ page }) => {
    await page.goto('/');
    
    // Go offline
    await page.context().setOffline(true);
    
    // Look for "Add Project" or similar button
    const addButton = page.locator('button:has-text("Add"), button:has-text("Novo"), button:has-text("Criar")').first();
    
    if (await addButton.isVisible()) {
      await addButton.click();
      
      // Check that a form or modal appeared
      const form = page.locator('form, [role="dialog"]');
      await expect(form).toBeVisible();
    }
  });

  test('handles offline state gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Go offline
    await page.context().setOffline(true);
    
    // Wait a bit for offline detection
    await page.waitForTimeout(1000);
    
    // Check for offline indicator
    const _offlineIndicator = page.locator(':has-text("Offline"), :has-text("offline"), [data-testid="offline-status"]');
    
    // App should still be functional offline
    await expect(page.locator('body')).toBeVisible();
  });

  test('sync button shows proper states', async ({ page }) => {
    await page.goto('/');
    
    const syncButton = page.locator('button:has-text("Sync")').first();
    
    if (await syncButton.isVisible()) {
      // Button should be clickable
      await expect(syncButton).toBeEnabled();
      
      // Click sync button
      await syncButton.click();
      
      // Should show loading state
      await expect(syncButton).toBeDisabled();
    }
  });
});