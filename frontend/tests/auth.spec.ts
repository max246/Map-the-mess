import { test, expect, type Page, type Route } from '@playwright/test'

// Helper: create a fake JWT with given payload
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

// Mock API routes so tests run without a backend
async function mockApi(page: Page) {
  // Register
  await page.route('**/api/auth/register', async (route: Route) => {
    const body = route.request().postDataJSON()
    if (body.email === 'taken@example.com') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Email already registered' }),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, email: body.email, full_name: body.full_name }),
      })
    }
  })

  // Login
  await page.route('**/api/auth/login', async (route: Route) => {
    const body = route.request().postDataJSON()
    if (body.email === 'volunteer@example.com' && body.password === 'password123') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: VOLUNTEER_TOKEN }),
      })
    } else if (body.email === 'unverified@example.com') {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Please verify your email first' }),
      })
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Invalid credentials' }),
      })
    }
  })

  // Forgot password
  await page.route('**/api/auth/forgot-password', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'ok' }),
    })
  })

  // Reset password
  await page.route('**/api/auth/reset-password', async (route: Route) => {
    const body = route.request().postDataJSON()
    if (body.token === 'valid-token') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'ok' }),
      })
    } else {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Invalid or expired token' }),
      })
    }
  })

  // Backend version
  await page.route('**/backend/', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: '1.0.0' }),
    })
  })

  // Nominatim geocoding
  await page.route('**/nominatim.openstreetmap.org/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { display_name: 'London, England, United Kingdom', lat: '51.5074', lon: '-0.1278' },
      ]),
    })
  })

  // Catch-all for other /api/ calls to prevent hangs (must not match vite internals)
  await page.route('**/api/reports**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/volunteers**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/auth/users**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/communities**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/auth/me', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'volunteer@example.com',
        full_name: 'Test User',
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

  await page.route('**/api/auth/verify**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'ok' }),
    })
  })
}

test.beforeEach(async ({ page }) => {
  await mockApi(page)
})

test.describe('Register flow', () => {
  test('page renders with all fields', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible()
    await expect(page.getByPlaceholder('Enter your full name')).toBeVisible()
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible()
    await expect(page.getByPlaceholder('At least 6 characters')).toBeVisible()
    await expect(page.getByPlaceholder('Re-enter your password')).toBeVisible()
  })

  test('register button is disabled until terms are accepted and city is selected', async ({
    page,
  }) => {
    await page.goto('/register')
    const registerBtn = page.getByRole('button', { name: /register/i })
    await expect(registerBtn).toBeDisabled()

    // Accepting terms alone is not enough
    await page.getByRole('checkbox').check()
    await expect(registerBtn).toBeDisabled()

    // Select a city
    await page.getByPlaceholder('Start typing your city...').fill('London')
    await page.getByText('London, England, United Kingdom').click()

    await expect(registerBtn).toBeEnabled()
  })

  test('terms checkbox links to disclaimer and privacy policy', async ({ page }) => {
    await page.goto('/register')
    const disclaimerLink = page.getByRole('link', { name: 'disclaimer and conditions of use' })
    await expect(disclaimerLink).toHaveAttribute('href', '/disclaimer')

    const privacyLink = page.getByRole('link', { name: 'privacy policy', exact: true })
    await expect(privacyLink).toHaveAttribute('href', '/privacy')
  })

  test('successful registration shows email verification message', async ({ page }) => {
    await page.goto('/register')

    await page.getByPlaceholder('Enter your full name').fill('Test User')
    await page.getByPlaceholder('Enter your email').fill('newuser@example.com')
    await page.getByPlaceholder('At least 6 characters').fill('password123')
    await page.getByPlaceholder('Re-enter your password').fill('password123')
    await page.getByPlaceholder('Start typing your city...').fill('London')
    await page.getByText('London, England, United Kingdom').click()
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /register/i }).click()

    await expect(page.getByText('Check your email')).toBeVisible()
    await expect(page.getByText('newuser@example.com')).toBeVisible()
  })

  test('shows error for password mismatch', async ({ page }) => {
    await page.goto('/register')

    await page.getByPlaceholder('Enter your full name').fill('Test User')
    await page.getByPlaceholder('Enter your email').fill('test@example.com')
    await page.getByPlaceholder('At least 6 characters').fill('password123')
    await page.getByPlaceholder('Re-enter your password').fill('different')
    await page.getByPlaceholder('Start typing your city...').fill('London')
    await page.getByText('London, England, United Kingdom').click()
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /register/i }).click()

    await expect(page.getByText('Passwords do not match.')).toBeVisible()
  })

  test('shows error for short password', async ({ page }) => {
    await page.goto('/register')

    await page.getByPlaceholder('Enter your full name').fill('Test User')
    await page.getByPlaceholder('Enter your email').fill('test@example.com')
    await page.getByPlaceholder('At least 6 characters').fill('12345')
    await page.getByPlaceholder('Re-enter your password').fill('12345')
    await page.getByPlaceholder('Start typing your city...').fill('London')
    await page.getByText('London, England, United Kingdom').click()
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /register/i }).click()

    await expect(page.getByText('Password must be at least 6 characters.')).toBeVisible()
  })

  test('shows error for duplicate email', async ({ page }) => {
    await page.goto('/register')

    await page.getByPlaceholder('Enter your full name').fill('Test User')
    await page.getByPlaceholder('Enter your email').fill('taken@example.com')
    await page.getByPlaceholder('At least 6 characters').fill('password123')
    await page.getByPlaceholder('Re-enter your password').fill('password123')
    await page.getByPlaceholder('Start typing your city...').fill('London')
    await page.getByText('London, England, United Kingdom').click()
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /register/i }).click()

    await expect(page.getByText('Email already registered')).toBeVisible()
  })

  test('has link to login page', async ({ page }) => {
    await page.goto('/register')
    const loginLink = page.getByRole('link', { name: /log in/i })
    await expect(loginLink).toHaveAttribute('href', '/login')
  })
})

test.describe('Login flow', () => {
  test('page renders with email and password fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible()
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible()
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible()
  })

  test('successful login redirects to admin', async ({ page }) => {
    await page.goto('/login')

    await page.getByPlaceholder('Enter your email').fill('volunteer@example.com')
    await page.getByPlaceholder('Enter your password').fill('password123')
    await page.getByRole('button', { name: /log in/i }).click()

    await page.waitForURL('**/admin')
    expect(page.url()).toContain('/admin')
  })

  test('stores token in localStorage after login', async ({ page }) => {
    await page.goto('/login')

    await page.getByPlaceholder('Enter your email').fill('volunteer@example.com')
    await page.getByPlaceholder('Enter your password').fill('password123')
    await page.getByRole('button', { name: /log in/i }).click()

    await page.waitForURL('**/admin')
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.getByPlaceholder('Enter your email').fill('wrong@example.com')
    await page.getByPlaceholder('Enter your password').fill('wrongpass')
    await page.getByRole('button', { name: /log in/i }).click()

    await expect(page.getByText('Invalid email or password.')).toBeVisible()
  })

  test('shows verify email message for unverified account', async ({ page }) => {
    await page.goto('/login')

    await page.getByPlaceholder('Enter your email').fill('unverified@example.com')
    await page.getByPlaceholder('Enter your password').fill('password123')
    await page.getByRole('button', { name: /log in/i }).click()

    await expect(page.getByText(/verify your email before logging in/i)).toBeVisible()
  })

  test('has link to forgot password', async ({ page }) => {
    await page.goto('/login')
    const link = page.getByRole('link', { name: /forgot your password/i })
    await expect(link).toHaveAttribute('href', '/forgot-password')
  })

  test('has link to register', async ({ page }) => {
    await page.goto('/login')
    const link = page.getByText("Don't have an account?").getByRole('link', { name: /register/i })
    await expect(link).toHaveAttribute('href', '/register')
  })
})

test.describe('Forgot password flow', () => {
  test('page renders', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible()
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible()
  })

  test('shows confirmation after submitting email', async ({ page }) => {
    await page.goto('/forgot-password')

    await page.getByPlaceholder('Enter your email').fill('test@example.com')
    await page.getByRole('button', { name: /send reset link/i }).click()

    await expect(page.getByText('Check your email')).toBeVisible()
    await expect(page.getByText('test@example.com')).toBeVisible()
  })

  test('has back to login link', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByRole('link', { name: /back to login/i })).toHaveAttribute(
      'href',
      '/login'
    )
  })
})

test.describe('Reset password flow', () => {
  test('shows token field when no token in URL', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(page.getByPlaceholder('Paste your reset token')).toBeVisible()
  })

  test('hides token field when token is in URL', async ({ page }) => {
    await page.goto('/reset-password?token=valid-token')
    await expect(page.getByPlaceholder('Paste your reset token')).not.toBeVisible()
  })

  test('successful password reset shows confirmation', async ({ page }) => {
    await page.goto('/reset-password?token=valid-token')

    await page.getByPlaceholder('At least 6 characters').fill('newpassword')
    await page.getByPlaceholder('Re-enter your new password').fill('newpassword')
    await page.getByRole('button', { name: /reset password/i }).click()

    await expect(page.getByText('Password reset')).toBeVisible()
    await expect(page.getByText(/password has been updated successfully/i)).toBeVisible()
  })

  test('shows error for password mismatch', async ({ page }) => {
    await page.goto('/reset-password?token=valid-token')

    await page.getByPlaceholder('At least 6 characters').fill('password1')
    await page.getByPlaceholder('Re-enter your new password').fill('password2')
    await page.getByRole('button', { name: /reset password/i }).click()

    await expect(page.getByText('Passwords do not match.')).toBeVisible()
  })

  test('shows error for invalid token', async ({ page }) => {
    await page.goto('/reset-password?token=bad-token')

    await page.getByPlaceholder('At least 6 characters').fill('newpassword')
    await page.getByPlaceholder('Re-enter your new password').fill('newpassword')
    await page.getByRole('button', { name: /reset password/i }).click()

    await expect(page.getByText(/invalid or expired reset token/i)).toBeVisible()
  })
})

test.describe('Register → Login full flow', () => {
  test('can register then login', async ({ page }) => {
    // Register
    await page.goto('/register')
    await page.getByPlaceholder('Enter your full name').fill('New User')
    await page.getByPlaceholder('Enter your email').fill('newuser@example.com')
    await page.getByPlaceholder('At least 6 characters').fill('password123')
    await page.getByPlaceholder('Re-enter your password').fill('password123')
    await page.getByPlaceholder('Start typing your city...').fill('London')
    await page.getByText('London, England, United Kingdom').click()
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /register/i }).click()

    await expect(page.getByText('Check your email')).toBeVisible()

    // Navigate to login
    await page.getByRole('link', { name: /go to login/i }).click()
    await page.waitForURL('**/login')

    // Login
    await page.getByPlaceholder('Enter your email').fill('volunteer@example.com')
    await page.getByPlaceholder('Enter your password').fill('password123')
    await page.getByRole('button', { name: /log in/i }).click()

    await page.waitForURL('**/admin')
    expect(page.url()).toContain('/admin')
  })
})
