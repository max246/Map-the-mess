import { test, expect, type Page, type Route } from '@playwright/test'

function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.fakesig`
}

const OWNER_TOKEN = fakeJwt({
  sub: 'owner@example.com',
  type: 'volunteer',
  user_id: 1,
  exp: Math.floor(Date.now() / 1000) + 3600,
})

const COMMUNITY = {
  id: 1,
  name: 'Test Community',
  description: 'A test community',
  latitude: 53.5,
  longitude: -1.5,
  radius_km: 10,
  owner_id: 1,
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
}

const EVENT = {
  id: 5,
  community_id: 1,
  title: 'Beach Cleanup',
  description: 'Bring **gloves** and bags',
  date: '2099-04-20T09:00:00Z',
  meeting_latitude: 53.5,
  meeting_longitude: -1.5,
  report_ids: [],
  created_at: '2026-03-01T12:00:00Z',
}

async function mockApi(page: Page) {
  // Use a single route handler for all community API calls to avoid
  // route-ordering issues where broader patterns intercept narrower ones.
  await page.route('**/api/communities/**', async (route: Route) => {
    const url = route.request().url()
    const method = route.request().method()

    // Single event: /api/communities/1/events/5
    if (/\/communities\/\d+\/events\/\d+$/.test(url)) {
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(EVENT),
        })
      }
      if (method === 'PATCH') {
        const body = route.request().postDataJSON()
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...EVENT, ...body }),
        })
      }
      if (method === 'DELETE') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      }
    }

    // Events collection: /api/communities/1/events
    if (/\/communities\/\d+\/events$/.test(url)) {
      if (method === 'POST') {
        const body = route.request().postDataJSON()
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...EVENT, ...body, id: 10 }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([EVENT]),
      })
    }

    // Members
    if (/\/members/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }

    // Posts
    if (/\/posts/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }

    // Single community: /api/communities/1
    if (/\/communities\/\d+$/.test(url) && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(COMMUNITY),
      })
    }

    // Fallback
    await route.continue()
  })

  // Communities list: /api/communities/
  await page.route('**/api/communities/', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([COMMUNITY]),
      })
    } else {
      await route.continue()
    }
  })

  // Reports
  await page.route('**/api/reports**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // Backend version
  await page.route('**/backend/', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: '1.0.0' }),
    })
  })

  // Auth login
  await page.route('**/api/auth/login', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: OWNER_TOKEN }),
    })
  })
}

async function loginAsOwner(page: Page) {
  // Set token in localStorage BEFORE React mounts, so AuthContext picks it up
  await page.addInitScript((token) => {
    localStorage.setItem('token', token)
  }, OWNER_TOKEN)
}

test.beforeEach(async ({ page }) => {
  await mockApi(page)
})

test.describe('Create Event page', () => {
  test('renders form with title, description, date fields', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/communities/1/events/new')

    await expect(page.getByRole('heading', { name: /new event/i })).toBeVisible()
    await expect(page.getByPlaceholder('Event title')).toBeVisible()
    await expect(page.getByRole('button', { name: /write/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /preview/i })).toBeVisible()
    await expect(page.getByText(/date & time/i)).toBeVisible()
  })

  test('Create button is disabled without title', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/communities/1/events/new')

    await expect(page.getByRole('button', { name: /create event/i })).toBeDisabled()
  })

  test('markdown preview works', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/communities/1/events/new')

    await page.getByPlaceholder(/describe the event/i).fill('**bold text**')
    await page.getByRole('button', { name: /preview/i }).click()

    await expect(page.locator('strong', { hasText: 'bold text' })).toBeVisible()
  })

  test('successful event creation redirects to community', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/communities/1/events/new')

    await page.getByPlaceholder('Event title').fill('Beach Cleanup')
    await page.getByPlaceholder(/describe the event/i).fill('Bring gloves')
    await page.locator('input[type="datetime-local"]').fill('2099-04-15T10:00')

    await page.getByRole('button', { name: /create event/i }).click()
    await page.waitForURL('**/communities/1')
  })
})

test.describe('Edit Event page', () => {
  test('loads existing event data into form', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/communities/1/events/5/edit')

    await expect(page.getByRole('heading', { name: /edit event/i })).toBeVisible()
    await expect(page.locator('input[type="text"]').first()).toHaveValue('Beach Cleanup')
  })

  test('can update event title and submit', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/communities/1/events/5/edit')

    const titleInput = page.locator('input[type="text"]').first()
    await titleInput.waitFor()
    await titleInput.clear()
    await titleInput.fill('Updated Cleanup')

    await page.getByRole('button', { name: /update event/i }).click()
    await page.waitForURL('**/communities/1')
  })
})

test.describe('Event Detail page', () => {
  test('displays event title and description', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/communities/1/events/5')

    await expect(page.getByRole('heading', { name: 'Beach Cleanup' })).toBeVisible()
    // Description rendered as markdown — check for bold text
    await expect(page.locator('strong', { hasText: 'gloves' })).toBeVisible()
  })

  test('shows date and meeting point info', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/communities/1/events/5')

    await expect(page.getByText('Date')).toBeVisible()
    await expect(page.getByText('Time')).toBeVisible()
    await expect(page.locator('span.text-gray-500', { hasText: 'Meeting point' })).toBeVisible()
  })

  test('shows edit and delete buttons for owner', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/communities/1/events/5')

    await expect(page.getByRole('link', { name: /edit/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /delete/i })).toBeVisible()
  })

  test('has back to community link', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/communities/1/events/5')

    const link = page.getByRole('link', { name: /back to community/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/communities/1')
  })
})
