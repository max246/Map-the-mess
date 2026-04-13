import { test, expect, type Page, type Route } from '@playwright/test'

function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.fakesig`
}

const VOLUNTEER_TOKEN = fakeJwt({
  sub: 'volunteer@example.com',
  type: 'volunteer',
  exp: Math.floor(Date.now() / 1000) + 3600,
})

const PLANS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Morning cleanup',
    start_latitude: 51.5,
    start_longitude: -0.1,
    status: 'planned',
    total_distance_meters: 2500,
    total_duration_seconds: 1800,
    report_count: 3,
    created_at: '2026-03-01T10:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: null,
    start_latitude: 52.0,
    start_longitude: -1.0,
    status: 'in_progress',
    total_distance_meters: 5200,
    total_duration_seconds: 3900,
    report_count: 5,
    created_at: '2026-03-05T14:00:00Z',
  },
]

const PLAN_DETAIL = {
  id: '00000000-0000-0000-0000-000000000001',
  user_id: '00000000-0000-0000-0000-000000000099',
  name: 'Morning cleanup',
  start_latitude: 51.5,
  start_longitude: -0.1,
  status: 'planned',
  total_distance_meters: 2500,
  total_duration_seconds: 1800,
  route_geometry: null,
  google_maps_url: 'https://www.google.com/maps/dir/?api=1&origin=51.5,-0.1',
  created_at: '2026-03-01T10:00:00Z',
  updated_at: null,
  plan_reports: [
    {
      id: 'pr-1',
      report_id: 'r-1',
      visit_order: 1,
      leg_distance_meters: 800,
      leg_duration_seconds: 600,
      report: {
        id: 'r-1',
        description: 'Bottles on path',
        status: 'pending',
        latitude: 51.51,
        longitude: -0.09,
        created_at: '2026-01-01T00:00:00Z',
        what3words: '',
        images: [],
      },
    },
  ],
}

const REPORTS = [
  {
    id: 'r-1',
    description: 'Bottles on path',
    status: 'pending',
    latitude: 51.5,
    longitude: -0.1,
    created_at: '2026-01-01T00:00:00Z',
    what3words: '',
    images: [],
  },
]

async function mockApi(page: Page) {
  await page.route('**/api/planner/', async (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PLANS),
      })
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(PLAN_DETAIL),
      })
    }
    await route.continue()
  })

  await page.route(/\/api\/planner\/[0-9a-f-]+$/, async (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PLAN_DETAIL),
      })
    }
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON()
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...PLAN_DETAIL, ...body }),
      })
    }
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ status: 204 })
    }
    await route.continue()
  })

  await page.route(/\/api\/planner\/[0-9a-f-]+\/start/, async (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...PLAN_DETAIL, status: 'in_progress' }),
    })
  })

  await page.route(/\/api\/planner\/[0-9a-f-]+\/complete/, async (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...PLAN_DETAIL, status: 'completed' }),
    })
  })

  await page.route('**/api/reports**', async (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(REPORTS),
    })
  })

  await page.route('**/api/auth/me', async (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000099',
        email: 'volunteer@example.com',
        full_name: 'Test Volunteer',
        is_verified: true,
        user_type: 'volunteer',
        avatar_url: null,
        city_latitude: 0,
        city_longitude: 0,
        created_at: '2026-01-01T00:00:00Z',
        badges: [],
      }),
    })
  })

  await page.route('**/api/volunteers**', async (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/communities**', async (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/backend/', async (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: '1.0.0' }),
    })
  })
}

async function loginAsVolunteer(page: Page) {
  // Set token in localStorage BEFORE React mounts, so AuthContext picks it up
  await page.addInitScript((token) => {
    localStorage.setItem('token', token)
  }, VOLUNTEER_TOKEN)
}

test.beforeEach(async ({ page }) => {
  await mockApi(page)
  await loginAsVolunteer(page)
})

test.describe('Planner List', () => {
  test('shows plans with names and statuses', async ({ page }) => {
    await page.goto('/planner')
    await expect(page.getByRole('heading', { name: /route planner/i })).toBeVisible()
    await expect(page.getByText('Morning cleanup')).toBeVisible()
    await expect(page.getByText('Untitled plan')).toBeVisible()
    await expect(page.getByText('Planned').first()).toBeVisible()
    await expect(page.getByText('In Progress').first()).toBeVisible()
  })

  test('has create plan button', async ({ page }) => {
    await page.goto('/planner')
    const link = page.getByRole('link', { name: /create plan/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/planner/new')
  })

  test('can filter plans by status tab', async ({ page }) => {
    await page.goto('/planner')
    await expect(page.getByText('Morning cleanup')).toBeVisible()

    await page.getByRole('button', { name: 'In Progress' }).click()
    await expect(page.getByText('Untitled plan')).toBeVisible()
    await expect(page.getByText('Morning cleanup')).not.toBeVisible()
  })

  test('plan card links to detail page', async ({ page }) => {
    await page.goto('/planner')
    await page.getByText('Morning cleanup').click()
    await page.waitForURL(/\/planner\/00000000/)
  })
})

test.describe('Plan Detail', () => {
  test('shows plan name, status, and stops', async ({ page }) => {
    await page.goto('/planner/00000000-0000-0000-0000-000000000001')
    await expect(page.getByText('Morning cleanup')).toBeVisible()
    await expect(page.getByText('Planned')).toBeVisible()
    await expect(page.getByText('Bottles on path')).toBeVisible()
    await expect(page.getByText('Stops (1)')).toBeVisible()
  })

  test('shows action buttons for planned status', async ({ page }) => {
    await page.goto('/planner/00000000-0000-0000-0000-000000000001')
    await expect(page.getByRole('button', { name: /start plan/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /open in google maps/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /export gpx/i })).toBeVisible()
  })

  test('can start a plan', async ({ page }) => {
    await page.goto('/planner/00000000-0000-0000-0000-000000000001')
    await page.getByRole('button', { name: /start plan/i }).click()
    await expect(page.getByText('In Progress')).toBeVisible()
  })

  test('shows delete confirmation modal', async ({ page }) => {
    await page.goto('/planner/00000000-0000-0000-0000-000000000001')
    await page.getByRole('button', { name: /^Delete$/ }).click()
    await expect(page.getByText(/delete this plan/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /yes, delete/i })).toBeVisible()
  })

  test('can dismiss delete confirmation', async ({ page }) => {
    await page.goto('/planner/00000000-0000-0000-0000-000000000001')
    await page.getByRole('button', { name: /^Delete$/ }).click()
    await expect(page.getByText(/delete this plan/i)).toBeVisible()

    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByText(/delete this plan/i)).not.toBeVisible()
  })

  test('can edit plan name', async ({ page }) => {
    await page.goto('/planner/00000000-0000-0000-0000-000000000001')
    await expect(page.getByText('Morning cleanup')).toBeVisible()

    await page.getByRole('button', { name: /edit/i }).click()
    const input = page.getByPlaceholder('Plan name')
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('Morning cleanup')

    await input.fill('Evening route')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText('Evening route')).toBeVisible()
  })

  test('back to plans link works', async ({ page }) => {
    await page.goto('/planner/00000000-0000-0000-0000-000000000001')
    await page.getByText(/back to plans/i).click()
    await page.waitForURL('**/planner')
  })
})

test.describe('Create Plan', () => {
  test('shows create plan page with map', async ({ page }) => {
    await page.goto('/planner/new')
    await expect(page.getByRole('heading', { name: /create plan/i })).toBeVisible()
    await expect(page.getByPlaceholder(/plan name/i)).toBeVisible()
    await expect(page.getByText('0/10 selected')).toBeVisible()
  })

  test('shows start point instruction', async ({ page }) => {
    await page.goto('/planner/new')
    await expect(page.getByText(/click the map to set your starting point/i)).toBeVisible()
  })

  test('cancel button navigates back', async ({ page }) => {
    await page.goto('/planner/new')
    await page.getByRole('button', { name: /cancel/i }).click()
    await page.waitForURL('**/planner')
  })
})
