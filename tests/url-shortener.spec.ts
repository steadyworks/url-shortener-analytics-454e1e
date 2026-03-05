import { test, expect } from '@playwright/test'

const FRONTEND = 'http://localhost:3000'
const BACKEND = 'http://localhost:3001'

function extractSlug(shortUrl: string): string {
  return shortUrl.trim().split('/').pop()!
}

test.beforeEach(async ({ page }) => {
  // Navigate to app origin so we can access its localStorage, then clear it
  await page.goto(FRONTEND)
  await page.evaluate(() => localStorage.clear())
})

// TC-1: Shorten a URL and verify analytics after multiple clicks with varied referrers
test('TC-1: analytics shows correct totals and referrer breakdown after varied-referrer clicks', async ({ page, request }) => {
  await page.goto(FRONTEND)
  await page.getByTestId('url-input').fill('https://example.com')
  await page.getByTestId('shorten-btn').click()

  const shortUrlEl = page.getByTestId('short-url-result')
  await expect(shortUrlEl).toBeVisible({ timeout: 10000 })
  const slug = extractSlug((await shortUrlEl.textContent())!)

  // 4 clicks with Referer: https://twitter.com
  for (let i = 0; i < 4; i++) {
    await request.get(`${BACKEND}/${slug}`, {
      headers: { Referer: 'https://twitter.com' },
      maxRedirects: 0,
    })
  }
  // 3 clicks with Referer: https://reddit.com
  for (let i = 0; i < 3; i++) {
    await request.get(`${BACKEND}/${slug}`, {
      headers: { Referer: 'https://reddit.com' },
      maxRedirects: 0,
    })
  }
  // 3 clicks with no Referer header
  for (let i = 0; i < 3; i++) {
    await request.get(`${BACKEND}/${slug}`, { maxRedirects: 0 })
  }

  await page.goto(`${FRONTEND}/analytics/${slug}`)

  await expect(page.getByTestId('total-clicks')).toHaveText('10', { timeout: 10000 })

  await expect(page.getByTestId('referrers-list')).toBeVisible()
  await expect(page.getByTestId('referrer-row')).not.toHaveCount(0)

  // Find the twitter.com row and verify its count is 4
  const twitterRow = page.getByTestId('referrer-row').filter({
    has: page.getByTestId('referrer-name').and(page.getByText('twitter.com', { exact: true })),
  })
  await expect(twitterRow.getByTestId('referrer-count')).toHaveText('4')

  // Find the reddit.com row and verify its count is 3
  const redditRow = page.getByTestId('referrer-row').filter({
    has: page.getByTestId('referrer-name').and(page.getByText('reddit.com', { exact: true })),
  })
  await expect(redditRow.getByTestId('referrer-count')).toHaveText('3')

  // Find the Direct row and verify its count is 3
  const directRow = page.getByTestId('referrer-row').filter({
    has: page.getByTestId('referrer-name').and(page.getByText('Direct', { exact: true })),
  })
  await expect(directRow.getByTestId('referrer-count')).toHaveText('3')

  await expect(page.getByTestId('clicks-chart')).toBeVisible()
}, 30000)

// TC-2: Link expires after reaching click limit
test('TC-2: link expires after reaching click limit', async ({ page, request }) => {
  await page.goto(FRONTEND)
  await page.getByTestId('url-input').fill('https://example.com')
  await page.getByTestId('max-clicks-input').fill('5')
  await page.getByTestId('shorten-btn').click()

  const shortUrlEl = page.getByTestId('short-url-result')
  await expect(shortUrlEl).toBeVisible({ timeout: 10000 })
  const slug = extractSlug((await shortUrlEl.textContent())!)

  // First 5 clicks: each should redirect to the target URL, NOT to /expired
  for (let i = 0; i < 5; i++) {
    const resp = await request.get(`${BACKEND}/${slug}`, { maxRedirects: 0 })
    expect(resp.status()).toBe(302)
    const location = resp.headers()['location'] ?? ''
    expect(location.toLowerCase()).not.toContain('/expired')
  }

  // 6th click: should follow redirects and land on the /expired page
  await page.goto(`${BACKEND}/${slug}`)
  await expect(page).toHaveURL(/\/expired/, { timeout: 10000 })
  await expect(page.getByTestId('expired-message')).toBeVisible()

  // Analytics should show 5 total clicks (the 6th was not counted)
  await page.goto(`${FRONTEND}/analytics/${slug}`)
  await expect(page.getByTestId('total-clicks')).toHaveText('5', { timeout: 10000 })
}, 30000)

// TC-3: Custom slug — success and duplicate rejection
test('TC-3: custom slug creates successfully and duplicate is rejected', async ({ page, request }) => {
  // Use a timestamp-suffixed slug to guarantee uniqueness across test runs
  const customSlug = `my-test-slug-${Date.now()}`

  await page.goto(FRONTEND)
  await page.getByTestId('url-input').fill('https://example.com')
  await page.getByTestId('custom-slug-input').fill(customSlug)
  await page.getByTestId('shorten-btn').click()

  // First creation should succeed
  const shortUrlEl = page.getByTestId('short-url-result')
  await expect(shortUrlEl).toBeVisible({ timeout: 10000 })
  await expect(shortUrlEl).toContainText(customSlug)
  await expect(page.getByTestId('shorten-error')).not.toBeVisible()

  // The slug should redirect to the target URL
  const resp = await request.get(`${BACKEND}/${customSlug}`, { maxRedirects: 0 })
  expect(resp.status()).toBe(302)
  const location = resp.headers()['location'] ?? ''
  expect(location).toContain('example.com')

  // Attempt to create a second link with the same slug
  await page.goto(FRONTEND)
  await page.getByTestId('url-input').fill('https://example.org')
  await page.getByTestId('custom-slug-input').fill(customSlug)
  await page.getByTestId('shorten-btn').click()

  // Should show an error and NOT show a new short URL
  await expect(page.getByTestId('shorten-error')).toBeVisible({ timeout: 10000 })
  await expect(page.getByTestId('short-url-result')).not.toBeVisible()
}, 30000)

// TC-4: Link expires after expiry date
test('TC-4: link expires after expiry date passes', async ({ page }) => {
  await page.goto(FRONTEND)
  await page.getByTestId('url-input').fill('https://example.com')

  // Remove any `min` attribute that might block past dates, then fill with a past datetime
  const expiryInput = page.getByTestId('expiry-date-input')
  await expiryInput.evaluate((el: HTMLInputElement) => el.removeAttribute('min'))
  await expiryInput.fill('2020-01-01T00:00')

  await page.getByTestId('shorten-btn').click()

  const shortUrlEl = page.getByTestId('short-url-result')
  await expect(shortUrlEl).toBeVisible({ timeout: 10000 })
  const slug = extractSlug((await shortUrlEl.textContent())!)

  // The expiry date is in the past, so following the short link should land on /expired
  await page.goto(`${BACKEND}/${slug}`)
  await expect(page).toHaveURL(/\/expired/, { timeout: 10000 })
  await expect(page.getByTestId('expired-message')).toBeVisible()
}, 30000)

// TC-5: Recent links list persistence
test('TC-5: recent links list persists in localStorage and reflects updated click count on reload', async ({ page, request }) => {
  // localStorage was already cleared in beforeEach
  await page.goto(FRONTEND)

  // With no saved links, the empty-state element should be visible
  await expect(page.getByTestId('empty-recent-links')).toBeVisible()

  await page.getByTestId('url-input').fill('https://example.com')
  await page.getByTestId('shorten-btn').click()

  const shortUrlEl = page.getByTestId('short-url-result')
  await expect(shortUrlEl).toBeVisible({ timeout: 10000 })
  const slug = extractSlug((await shortUrlEl.textContent())!)

  // At least one recent-link-card should now appear
  await expect(page.getByTestId('recent-link-card')).not.toHaveCount(0, { timeout: 5000 })

  // Find the card for this specific slug
  const card = page.getByTestId('recent-link-card').filter({ hasText: slug })
  await expect(card).toBeVisible()
  await expect(card.getByTestId('recent-link-short-url')).toContainText(slug)
  await expect(card.getByTestId('recent-link-clicks')).toHaveText('0')

  // Simulate 3 clicks via the backend
  for (let i = 0; i < 3; i++) {
    await request.get(`${BACKEND}/${slug}`, { maxRedirects: 0 })
  }

  // Reload the page — the slug must still be present (persisted in localStorage)
  await page.reload()

  const cardAfterReload = page.getByTestId('recent-link-card').filter({ hasText: slug })
  await expect(cardAfterReload).toBeVisible({ timeout: 10000 })
  // Click count should now reflect the 3 backend requests
  await expect(cardAfterReload.getByTestId('recent-link-clicks')).toHaveText('3', { timeout: 10000 })
}, 30000)

// TC-6: Geographic breakdown appears after a click
test('TC-6: geographic breakdown is present after at least one click', async ({ page, request }) => {
  await page.goto(FRONTEND)
  await page.getByTestId('url-input').fill('https://example.com')
  await page.getByTestId('shorten-btn').click()

  const shortUrlEl = page.getByTestId('short-url-result')
  await expect(shortUrlEl).toBeVisible({ timeout: 10000 })
  const slug = extractSlug((await shortUrlEl.textContent())!)

  // Send 1 click to the backend
  await request.get(`${BACKEND}/${slug}`, { maxRedirects: 0 })

  await page.goto(`${FRONTEND}/analytics/${slug}`)

  const geoList = page.getByTestId('geo-list')
  await expect(geoList).toBeVisible({ timeout: 10000 })

  const geoRows = geoList.getByTestId('geo-row')
  await expect(geoRows).not.toHaveCount(0)

  // Each row must have a non-empty country name and a numeric count >= 1
  const rowCount = await geoRows.count()
  for (let i = 0; i < rowCount; i++) {
    const row = geoRows.nth(i)
    const countryText = (await row.getByTestId('geo-country').textContent()) ?? ''
    expect(countryText.trim().length).toBeGreaterThan(0)
    const countText = (await row.getByTestId('geo-count').textContent()) ?? '0'
    expect(parseInt(countText.trim(), 10)).toBeGreaterThanOrEqual(1)
  }
}, 30000)
