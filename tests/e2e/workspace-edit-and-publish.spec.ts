import { expect, test } from '@playwright/test';

const workspacePayload = {
  repo: { owner: 'octocat', name: 'edu-publish-main' },
  branch: 'main',
  baseHeadSha: 'head-sha-main',
  readonlyConfig: {
    siteYaml: 'site_name: Demo Site\n',
    widgetsYaml: 'modules:\n  dashboard: true\n',
    subscriptionsYaml: 'schools:\n  - slug: demo\n    name: Demo School\n    subscriptions:\n      - title: Demo Source\n',
  },
  attachments: [],
  cards: [
    {
      id: 'notice-1',
      path: 'content/card/demo/notice-1.md',
      sha: 'sha-1',
      raw: `---\nid: notice-1\nschool_slug: demo\ntitle: First notice\npublished: 2026-04-14T09:00:00+08:00\ncategory: 通知公告\nsource:\n  channel: Demo Source\n---\nOriginal body.\n`,
      frontmatterText: 'id: notice-1\nschool_slug: demo\ntitle: First notice\npublished: 2026-04-14T09:00:00+08:00\ncategory: 通知公告\nsource:\n  channel: Demo Source',
      bodyMarkdown: 'Original body.\n',
      keyOrder: ['id', 'school_slug', 'title', 'published', 'category', 'source'],
      data: {
        id: 'notice-1',
        school_slug: 'demo',
        title: 'First notice',
        published: '2026-04-14T09:00:00+08:00',
        category: '通知公告',
        source: { channel: 'Demo Source' },
      },
      dirty: false,
    },
  ],
};

test('loads a workspace, edits a card, confirms preview, and publishes successfully', async ({ page }) => {
  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        viewer: { login: 'octocat', name: 'The Octocat' },
      }),
    });
  });
  await page.route('**/api/repos', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        repos: [
          {
            owner: 'octocat',
            name: 'edu-publish-main',
            fullName: 'octocat/edu-publish-main',
            defaultBranch: 'main',
            private: true,
            permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
            updatedAt: '2026-04-14T12:00:00Z',
          },
        ],
      }),
    });
  });
  await page.route('**/api/repos/octocat/edu-publish-main/branches', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        branches: [{ name: 'main', headSha: 'head-sha-main' }],
      }),
    });
  });
  await page.route('**/api/workspace/load', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(workspacePayload),
    });
  });
  await page.route('**/api/publish', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        commitSha: 'new-commit-sha',
        targetBranch: 'main',
        compareUrl: 'https://github.com/octocat/edu-publish-main/compare/head-sha-main...new-commit-sha',
        publishedAt: '2026-04-14T10:00:00.000Z',
      }),
    });
  });

  await page.goto('/');

  await page.selectOption('select[aria-label="Repository"]', 'octocat/edu-publish-main');
  await expect(page.locator('select[aria-label="Branch"]')).toHaveValue('main');
  await page.getByRole('button', { name: 'Load Workspace' }).click();

  await expect(page.getByLabel('Card editor panel').getByText('content/card/demo/notice-1.md')).toBeVisible();
  await page.getByLabel('Title').fill('Updated from E2E');
  await expect(page.getByRole('button', { name: 'Open notice: Updated from E2E' })).toBeVisible();

  await page.getByRole('button', { name: 'Review Publish' }).click();
  await page.getByRole('button', { name: 'Publish Changes' }).click();

  await expect(page.getByLabel('Review publish dialog').getByText('new-commit-sha', { exact: true })).toBeVisible();
  await expect(page.getByText('Publish Complete')).toBeVisible();
});
