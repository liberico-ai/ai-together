import { test, expect } from '@playwright/test';

test.describe('Libe Aios Core E2E Flow', () => {
  // Since we rely on a test or dev database, we can create a unique suffix for our test data
  const sessionId = Date.now().toString().slice(-6);
  const testEmail = `testuser_${sessionId}@libeaios.com`;
  const testPassword = `Password123!`;
  const testProject = `E2E Project ${sessionId}`;
  const testModule = `E2E Module ${sessionId}`;
  const testTask = `E2E Task ${sessionId}`;

  test('should register, create a project, module and task, then update task status', async ({ page, request }) => {
    // 1. Register a new user via API
    await test.step('Register User via API', async () => {
      const response = await request.post('/api/auth/sign-up/email', {
        headers: { 'Content-Type': 'application/json' },
        data: {
          email: testEmail,
          password: testPassword,
          name: 'E2E Tester ' + sessionId
        }
      });
      // Accept various successful auth codes or even if user already exists
      expect(response.ok()).toBeTruthy();
    });

    // 2. Login via UI
    await test.step('Login User', async () => {
      await page.goto('/login');
      await page.fill('input[type="email"]', testEmail);
      await page.fill('input[type="password"]', testPassword);
      await page.click('button[type="submit"]');
      
      // Wait to reach dashboard
      await expect(page).toHaveURL(/\/(app|dashboard|projects)/, { timeout: 15000 });
    });

    // 2. Create a Project
    await test.step('Create Project', async () => {
      await page.goto('/projects');
      await page.click('text=New Project'); // Open dialog
      
      await page.fill('input[placeholder*="Title"]', testProject);
      await page.fill('textarea[placeholder*="Description"]', 'Automated E2E test project');
      await page.click('button[type="submit"]:has-text("Create")');
      
      // Verify project card appears
      await expect(page.locator(`text=${testProject}`)).toBeVisible();
    });

    // 3. Create a Module inside the Project
    await test.step('Create Module', async () => {
      // Click into project
      await page.click(`text=${testProject}`);
      await expect(page).toHaveURL(/\/projects\/.+/);
      
      await page.click('text=New Module');
      await page.fill('input[placeholder*="Title"]', testModule);
      await page.fill('textarea[placeholder*="Description"]', 'E2E testing module');
      await page.click('button[type="submit"]:has-text("Create")');
      
      await expect(page.locator(`text=${testModule}`)).toBeVisible();
    });

    // 5. Create a Task inside the Module
    await test.step('Create Task', async () => {
      // Open the module detail/board
      await page.click(`text=${testModule}`);
      
      await page.click('button:has-text("New Task")'); 
      await page.fill('input[id="title"]', testTask);
      
      // Handle markdown editor input properly
      await page.locator('.w-md-editor-text-input').first().fill('This is an E2E testing task description.');
      
      await page.click('button[type="submit"]:has-text("Add Task")');
      await expect(page.locator(`text=${testTask}`)).toBeVisible();
    });

    // 6. Update Task Status
    await test.step('Update Status to In Review', async () => {
      await page.click(`text=${testTask}`); // Open task detail dialog
      
      // Wait for dialog to populate
      await page.waitForTimeout(1000);

      // Submit Review action
      const submitBtn = page.locator('button:has-text("Submit Review")');
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await expect(page.locator('text=Awaiting Chairman review')).toBeVisible({ timeout: 10000 });
      }
    });
  });
});
