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
  // Communities list
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

  // Single community
  await page.route('**/api/communities/1', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(COMMUNITY),
      })
    } else {
      await route.continue()
    }
  })

  // Events list / create
  await page.route('**/api/communities/1/events', async (route: Route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...EVENT, ...body, id: 10 }),
      })
    } else if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([EVENT]),
      })
    } else {
      await route.continue()
    }
  })

  // Single event
  await page.route('**/api/communities/1/events/5', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EVENT),
      })
    } else if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...EVENT, ...body }),
      })
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
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

  // Auth login (needed for setting up logged-in state)
  await page.route('**/api/auth/login', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: OWNER_TOKEN }),
    })
  })

  // Catch-all for other community-related API calls
  await page.route('**/api/communities/1/members**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/communities/1/posts**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
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
