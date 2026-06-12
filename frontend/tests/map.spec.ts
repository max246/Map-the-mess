import { test, expect, type Page, type Route } from '@playwright/test'

const REPORTS = [
  {
    id: '1',
    description: 'Bottles on path',
    status: 'reported',
    latitude: 51.5,
    longitude: -0.1,
    created_at: '2026-01-01T00:00:00Z',
    what3words: 'fill.count.soap',
    images: [],
  },
  {
    id: '2',
    description: 'Bags in park',
    status: 'cleaned',
    latitude: 52.0,
    longitude: -1.0,
    created_at: '2026-01-02T00:00:00Z',
    what3words: '',
    images: [],
  },
  {
    id: '3',
    description: 'Cans near bus stop',
    status: 'reported',
    latitude: 53.0,
    longitude: -2.0,
    created_at: '2026-01-03T00:00:00Z',
    what3words: '',
    images: [],
  },
]

async function mockApi(page: Page) {
  await page.route(/\/api\//, async (route: Route) => {
    const url = new URL(route.request().url())
    const path = url.pathname

    if (/^\/api\/reports/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(REPORTS),
      })
    }

    if (/^\/api\/volunteers/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }

    if (/^\/api\/auth\//.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'ok' }),
      })
    }

    if (/^\/api\/bins/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }

    await route.continue()
  })

  await page.route('**/backend/', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: '1.0.0' }),
    })
  })
}

test.beforeEach(async ({ page }) => {
  await mockApi(page)
})

test.describe('Map View', () => {
  test('defaults to Unresolved filter', async ({ page }) => {
    await page.goto('/map')

    // Expand status panel
    await page.getByTitle('Status filter').click()
    const unresolvedBtn = page.getByRole('button', { name: 'Unresolved' })
    await expect(unresolvedBtn).toBeVisible()
    await expect(unresolvedBtn).toHaveClass(/bg-brand/)
  })

  test('shows filter buttons (All, Unresolved, Resolved)', async ({ page }) => {
    await page.goto('/map')

    await page.getByTitle('Status filter').click()
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Unresolved' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Resolved', exact: true })).toBeVisible()
  })

  test('shows layer toggle buttons (Pins, Heatmap)', async ({ page }) => {
    await page.goto('/map')

    await page.getByTitle('Layer toggle').click()
    await expect(page.getByRole('button', { name: 'Pins' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Heatmap' })).toBeVisible()
  })

  test('Pins layer is active by default', async ({ page }) => {
    await page.goto('/map')

    await page.getByTitle('Layer toggle').click()
    const pinsBtn = page.getByRole('button', { name: 'Pins' })
    await expect(pinsBtn).toHaveClass(/bg-brand/)
  })

  test('can switch between All and Unresolved filters', async ({ page }) => {
    await page.goto('/map')

    await page.getByTitle('Status filter').click()

    // Default is Unresolved
    await expect(page.getByRole('button', { name: 'Unresolved' })).toHaveClass(/bg-brand/)

    // Switch to All
    await page.getByRole('button', { name: 'All' }).click()
    await expect(page.getByRole('button', { name: 'All' })).toHaveClass(/bg-brand/)
    await expect(page.getByRole('button', { name: 'Unresolved' })).not.toHaveClass(/bg-brand/)
  })

  test('can switch to Heatmap layer', async ({ page }) => {
    await page.goto('/map')

    await page.getByTitle('Layer toggle').click()
    await page.getByRole('button', { name: 'Heatmap' }).click()
    await expect(page.getByRole('button', { name: 'Heatmap' })).toHaveClass(/bg-brand/)
    await expect(page.getByRole('button', { name: 'Pins' })).not.toHaveClass(/bg-brand/)
  })

  test('can switch back to Pins layer from Heatmap', async ({ page }) => {
    await page.goto('/map')

    await page.getByTitle('Layer toggle').click()
    await page.getByRole('button', { name: 'Heatmap' }).click()
    await expect(page.getByRole('button', { name: 'Heatmap' })).toHaveClass(/bg-brand/)

    await page.getByRole('button', { name: 'Pins' }).click()
    await expect(page.getByRole('button', { name: 'Pins' })).toHaveClass(/bg-brand/)
  })

  test('filter persists when switching layers', async ({ page }) => {
    await page.goto('/map')

    // Expand status panel and switch to Resolved filter
    await page.getByTitle('Status filter').click()
    await page.getByRole('button', { name: 'Resolved', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Resolved', exact: true })).toHaveClass(
      /bg-brand/
    )

    // Expand layer panel and switch to Heatmap
    await page.getByTitle('Layer toggle').click()
    await page.getByRole('button', { name: 'Heatmap' }).click()

    // Re-expand status panel — Resolved filter should still be active
    await page.getByTitle('Status filter').click()
    await expect(page.getByRole('button', { name: 'Resolved', exact: true })).toHaveClass(
      /bg-brand/
    )
  })
})
