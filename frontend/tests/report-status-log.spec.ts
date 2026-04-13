import { test, expect, type Page, type Route } from '@playwright/test'

/* ── Mock data ────────────────────────────────────── */

const RESOLVED_REPORT = {
  id: '00000000-0000-0000-0000-00000000ab42',
  description: 'Bottles near path',
  status: 'cleaned',
  latitude: 51.5,
  longitude: -0.1,
  created_at: '2026-01-01T08:00:00Z',
  what3words: '',
  address: '123 Test Street',
  resolved_at: '2026-01-05T12:00:00Z',
  current_cycle: 0,
  report_type: 'litter',
  status_log: [
    {
      id: 'log-1',
      action: 'created',
      cycle: 0,
      performed_by_user_id: null,
      created_at: '2026-01-01T08:00:00Z',
    },
    {
      id: 'log-2',
      action: 'cleaned',
      cycle: 0,
      performed_by_user_id: 'user-1',
      created_at: '2026-01-05T12:00:00Z',
    },
  ],
  images: [
    {
      id: 'img-1',
      url: 'report1.jpg',
      thumbnail_url: 'report1_thumb.jpg',
      image_type: 'report',
      cycle: 0,
      created_at: '2026-01-01T08:00:00Z',
    },
    {
      id: 'img-2',
      url: 'resolved1.jpg',
      thumbnail_url: 'resolved1_thumb.jpg',
      image_type: 'resolved',
      cycle: 0,
      created_at: '2026-01-05T12:00:00Z',
    },
  ],
}

const REOPENED_REPORT = {
  ...RESOLVED_REPORT,
  status: 'pending',
  resolved_at: null,
  current_cycle: 1,
  status_log: [
    ...RESOLVED_REPORT.status_log,
    {
      id: 'log-3',
      action: 'reopened',
      cycle: 1,
      performed_by_user_id: null,
      created_at: '2026-01-10T09:00:00Z',
    },
  ],
  images: [
    ...RESOLVED_REPORT.images,
    {
      id: 'img-3',
      url: 'reopen1.jpg',
      thumbnail_url: 'reopen1_thumb.jpg',
      image_type: 'report',
      cycle: 1,
      created_at: '2026-01-10T09:00:00Z',
    },
  ],
}

/* ── Helpers ──────────────────────────────────────── */

async function mockApi(page: Page, report: Record<string, unknown>) {
  await page.route(/\/api\/reports\/images\//, async (route: Route) => {
    // Return a 1x1 transparent PNG for any image request
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )
    await route.fulfill({ status: 200, contentType: 'image/png', body: pixel })
  })

  await page.route(/\/api\/reports\/[0-9a-f-]+\/unresolve/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(REOPENED_REPORT),
    })
  })

  await page.route(/\/api\/reports\/[0-9a-f-]+$/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(report),
    })
  })

  await page.route(/\/api\/volunteers/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/backend/', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: '1.0.0' }),
    })
  })
}

/* ── Tests ────────────────────────────────────────── */

test.describe('Report Status Log & Reopen', () => {
  test('shows status timeline on resolved report', async ({ page }) => {
    await mockApi(page, RESOLVED_REPORT)
    await page.goto('/report/00000000-0000-0000-0000-00000000ab42')

    // Timeline should be visible
    await expect(page.getByText('History')).toBeVisible()
    await expect(page.getByText('Reported', { exact: true })).toBeVisible()
  })

  test('shows reopen button on resolved report', async ({ page }) => {
    await mockApi(page, RESOLVED_REPORT)
    await page.goto('/report/00000000-0000-0000-0000-00000000ab42')

    await expect(page.getByRole('button', { name: /report still dirty/i })).toBeVisible()
  })

  test('can open and cancel the reopen form', async ({ page }) => {
    await mockApi(page, RESOLVED_REPORT)
    await page.goto('/report/00000000-0000-0000-0000-00000000ab42')

    await page.getByRole('button', { name: /report still dirty/i }).click()
    await expect(page.getByText(/if this area is still dirty/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /reopen report/i })).toBeVisible()

    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('button', { name: /reopen report/i })).not.toBeVisible()
  })

  test('can reopen report without photo', async ({ page }) => {
    await mockApi(page, RESOLVED_REPORT)
    await page.goto('/report/00000000-0000-0000-0000-00000000ab42')

    await page.getByRole('button', { name: /report still dirty/i }).click()
    await page.getByRole('button', { name: /reopen report/i }).click()

    // After reopen, the report refreshes — the Reopened entry should appear
    await expect(page.getByText('Reopened')).toBeVisible()
  })

  test('reopened report shows only current cycle images', async ({ page }) => {
    await mockApi(page, REOPENED_REPORT)
    await page.goto('/report/00000000-0000-0000-0000-00000000ab42')

    // Main gallery should show only 1 thumbnail (cycle 1 image)
    const thumbnails = page.getByAltText(/^Thumbnail \d+$/)
    await expect(thumbnails).toHaveCount(1)
  })

  test('timeline shows expandable old cycle photos', async ({ page }) => {
    await mockApi(page, REOPENED_REPORT)
    await page.goto('/report/00000000-0000-0000-0000-00000000ab42')

    // Find and click the "View photos" link
    const viewLink = page.getByText(/View 2 photos from this period/).first()
    await expect(viewLink).toBeVisible()
    await viewLink.click()

    // Old cycle thumbnails should be visible
    const oldPhotos = page.getByAltText('Previous cycle')
    await expect(oldPhotos.first()).toBeVisible()

    // Click "Hide photos" to collapse
    await page.getByText('Hide photos').first().click()
    await expect(oldPhotos.first()).not.toBeVisible()
  })
})
