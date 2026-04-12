import { test, expect, type Page, type Route } from '@playwright/test'

async function mockBackend(page: Page, createHandler: (route: Route) => Promise<void>) {
  await page.route('**/backend/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: '1.0.0' }),
    })
  })

  await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // Only intercept backend /api/ requests, not Vite's /src/api/* dev-server modules.
  await page.route(
    (url) => url.host === 'localhost:5173' && url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url())
      const method = route.request().method()
      if (url.pathname === '/api/reports/' && method === 'POST') {
        await createHandler(route)
        return
      }
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
    }
  )
}

// Patch navigator.onLine before the app boots so the queue takes the offline path
// without Playwright's setOffline() blocking the mocked API routes.
async function installOnlineToggle(page: Page) {
  await page.addInitScript(() => {
    let onlineState = false
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get() {
        return onlineState
      },
    })
    ;(window as unknown as { __setOnline: (v: boolean) => void }).__setOnline = (
      v: boolean
    ) => {
      onlineState = v
      window.dispatchEvent(new Event(v ? 'online' : 'offline'))
    }
  })
}

const fillAndSubmitReport = async (page: Page) => {
  await page.goto('/report')
  // Location is detected automatically in the background — wait for coordinates to appear
  await expect(page.getByText(/51\.50740/)).toBeVisible({ timeout: 10000 })
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /submit report/i }).click()
}

test.describe('Offline report submission', () => {
  test.use({
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
    permissions: ['geolocation'],
  })

  test('queues a report while offline and flushes it when back online', async ({ page }) => {
    let createCallCount = 0
    await mockBackend(page, async (route) => {
      createCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 42,
          latitude: 51.5074,
          longitude: -0.1278,
          report_type: 'litter',
          description: '',
          status: 'pending',
          created_at: '2026-01-01T00:00:00Z',
        }),
      })
    })
    await installOnlineToggle(page)

    await fillAndSubmitReport(page)

    // Offline success screen — the report was queued locally.
    await expect(page.getByText(/saved on your device/i)).toBeVisible()
    // The top banner tells the user what to do.
    const banner = page.getByRole('status').filter({ hasText: /you['’]re offline/i })
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(/upload automatically/i)
    expect(createCallCount).toBe(0)

    // Simulate coming back online.
    await page.evaluate(() => {
      ;(window as unknown as { __setOnline: (v: boolean) => void }).__setOnline(true)
    })

    // Banner drains and disappears once the flush completes.
    await expect(banner).toBeHidden({ timeout: 10000 })
    await expect.poll(() => createCallCount, { timeout: 10000 }).toBe(1)
  })

  test('shows a retry button and re-flushes after a server error', async ({ page }) => {
    let createCallCount = 0
    await mockBackend(page, async (route) => {
      createCallCount++
      if (createCallCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'internal error' }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 43,
            latitude: 51.5074,
            longitude: -0.1278,
            report_type: 'litter',
            description: '',
            status: 'pending',
            created_at: '2026-01-01T00:00:00Z',
          }),
        })
      }
    })
    await installOnlineToggle(page)

    await fillAndSubmitReport(page)
    await expect(page.getByText(/saved on your device/i)).toBeVisible()

    // Go online → flush tries once → backend 500 → banner turns red with retry.
    await page.evaluate(() => {
      ;(window as unknown as { __setOnline: (v: boolean) => void }).__setOnline(true)
    })

    await expect(page.getByText(/couldn['’]t upload/i)).toBeVisible({ timeout: 10000 })
    await expect.poll(() => createCallCount, { timeout: 10000 }).toBe(1)

    // Click retry; the second attempt succeeds and the banner disappears.
    await page.getByRole('button', { name: /retry now/i }).click()
    await expect(page.getByText(/couldn['’]t upload/i)).toBeHidden({ timeout: 10000 })
    await expect.poll(() => createCallCount, { timeout: 10000 }).toBe(2)
  })
})
