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
  attendee_count: 0,
  is_attending: false,
  created_at: '2026-03-01T12:00:00Z',
}

async function mockApi(page: Page) {
  // Single handler for ALL API calls to avoid Playwright route-ordering issues
  await page.route(/\/api\//, async (route: Route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const method = route.request().method()

    // My communities: /api/communities/mine
    if (/^\/api\/communities\/mine$/.test(path) && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          owned: [COMMUNITY],
          joined: [COMMUNITY],
          pending: [],
          rejected: [],
        }),
      })
    }

    // Event attendance: /api/communities/:id/events/:eventId/attend
    if (/^\/api\/communities\/\d+\/events\/\d+\/attend$/.test(path)) {
      if (method === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...EVENT, is_attending: true, attendee_count: 1 }),
        })
      }
      if (method === 'DELETE') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...EVENT, is_attending: false, attendee_count: 0 }),
        })
      }
    }

    // Single event: /api/communities/:id/events/:eventId
    if (/^\/api\/communities\/\d+\/events\/\d+$/.test(path)) {
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

    // Events collection: /api/communities/:id/events
    if (/^\/api\/communities\/\d+\/events$/.test(path)) {
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
    if (/^\/api\/communities\/\d+\/members/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }

    // Posts
    if (/^\/api\/communities\/\d+\/posts/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }

    // Single community: /api/communities/:id
    if (/^\/api\/communities\/\d+$/.test(path) && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(COMMUNITY),
      })
    }

    // Communities list: /api/communities/
    if (/^\/api\/communities\/?$/.test(path) && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([COMMUNITY]),
      })
    }

    // Reports
    if (/^\/api\/reports/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }

    // Auth login
    if (/^\/api\/auth\/login/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: OWNER_TOKEN }),
      })
    }

    // Auth catch-all
    if (/^\/api\/auth\//.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'ok' }),
      })
    }

    // Volunteers
    if (/^\/api\/volunteers/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }

    // Fallback - let unknown API calls through
    await route.continue()
  })

  // Backend version (not under /api/)
  await page.route('**/backend/', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: '1.0.0' }),
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

    // Wait for data to load (heading only shows after loading finishes)
    await expect(page.getByRole('heading', { name: /edit event/i })).toBeVisible()

    const titleInput = page.getByPlaceholder('Event title')
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

  test('shows attendee count', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/communities/1/events/5')

    await expect(page.getByText(/people attending/)).toBeVisible()
  })

  test('shows Attend button for community member', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/communities/1/events/5')

    await expect(page.getByRole('button', { name: 'Attend' })).toBeVisible()
  })

  test('clicking Attend toggles to Leave event', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/communities/1/events/5')

    await page.getByRole('button', { name: 'Attend' }).click()
    await expect(page.getByRole('button', { name: 'Leave event' })).toBeVisible()
  })

  test('clicking Leave event toggles back to Attend', async ({ page }) => {
    await loginAsOwner(page)

    // Start with the user already attending
    await page.route(/\/api\/communities\/\d+\/events\/\d+$/, async (route: Route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...EVENT, is_attending: true, attendee_count: 1 }),
        })
      }
      await route.continue()
    })

    await page.goto('/communities/1/events/5')

    await page.getByRole('button', { name: 'Leave event' }).click()
    await expect(page.getByRole('button', { name: 'Attend' })).toBeVisible()
  })

  test('hides Attend button for past events', async ({ page }) => {
    await loginAsOwner(page)

    const PAST_EVENT = {
      ...EVENT,
      date: '2020-01-01T09:00:00Z',
    }
    await page.route(/\/api\/communities\/\d+\/events\/\d+$/, async (route: Route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(PAST_EVENT),
        })
      }
      await route.continue()
    })

    await page.goto('/communities/1/events/5')
    await expect(page.getByText('Past')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Attend' })).not.toBeVisible()
  })
})
