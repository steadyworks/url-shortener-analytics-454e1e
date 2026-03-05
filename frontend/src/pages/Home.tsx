import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const BACKEND = 'http://localhost:3001'
const LS_KEY = 'recentLinks'

interface RecentLink {
  slug: string
  short_url: string
  original_url: string
  click_count: number
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [customSlug, setCustomSlug] = useState('')
  const [maxClicks, setMaxClicks] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ slug: string; short_url: string } | null>(null)
  const [recentLinks, setRecentLinks] = useState<RecentLink[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  useEffect(() => {
    loadRecentLinks()
  }, [])

  async function loadRecentLinks() {
    setLoadingRecent(true)
    try {
      const slugs: string[] = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
      if (slugs.length === 0) {
        setRecentLinks([])
        return
      }
      const results = await Promise.all(
        slugs.map(async (slug) => {
          try {
            const res = await fetch(`${BACKEND}/api/links/${slug}`)
            if (!res.ok) return null
            const data = await res.json()
            return {
              slug,
              short_url: `${BACKEND}/${slug}`,
              original_url: data.original_url,
              click_count: data.click_count,
            } as RecentLink
          } catch {
            return null
          }
        })
      )
      setRecentLinks(results.filter(Boolean) as RecentLink[])
    } finally {
      setLoadingRecent(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)

    const body: Record<string, unknown> = { url }
    if (customSlug.trim()) body.slug = customSlug.trim()
    if (maxClicks.trim()) body.max_clicks = parseInt(maxClicks, 10)
    if (expiryDate.trim()) body.expires_at = expiryDate.trim()

    try {
      const res = await fetch(`${BACKEND}/api/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'An error occurred')
        return
      }
      setResult({ slug: data.slug, short_url: data.short_url })

      // Save slug to localStorage
      const existing: string[] = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
      if (!existing.includes(data.slug)) {
        existing.unshift(data.slug)
        localStorage.setItem(LS_KEY, JSON.stringify(existing))
      }

      // Reload recent links
      await loadRecentLinks()
    } catch {
      setError('Failed to connect to the server')
    }
  }

  const isEmpty = !loadingRecent && recentLinks.length === 0

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">URL Shortener</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 mb-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Long URL *</label>
            <input
              data-testid="url-input"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom Slug (optional)</label>
            <input
              data-testid="custom-slug-input"
              type="text"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value)}
              placeholder="my-custom-slug"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Clicks (optional)</label>
              <input
                data-testid="max-clicks-input"
                type="number"
                value={maxClicks}
                onChange={(e) => setMaxClicks(e.target.value)}
                placeholder="100"
                min="1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (optional)</label>
              <input
                data-testid="expiry-date-input"
                type="datetime-local"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            data-testid="shorten-btn"
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Shorten URL
          </button>
        </form>

        {error && (
          <div
            data-testid="shorten-error"
            className="bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 mb-6"
          >
            {error}
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-300 rounded-xl p-4 mb-8">
            <p className="text-sm text-gray-600 mb-1">Your short URL:</p>
            <p
              data-testid="short-url-result"
              className="font-mono text-blue-700 text-lg font-semibold break-all"
            >
              {result.short_url}
            </p>
            <Link
              data-testid="analytics-link"
              to={`/analytics/${result.slug}`}
              className="mt-2 inline-block text-sm text-blue-600 hover:underline"
            >
              View Analytics
            </Link>
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Links</h2>
          {isEmpty ? (
            <p
              data-testid="empty-recent-links"
              className="text-gray-500 text-sm"
            >
              No recent links yet. Create one above!
            </p>
          ) : (
            <div data-testid="recent-links-list" className="space-y-3">
              {recentLinks.map((link) => (
                <div
                  key={link.slug}
                  data-testid="recent-link-card"
                  className="bg-white rounded-xl shadow p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        data-testid="recent-link-short-url"
                        className="font-mono text-blue-700 text-sm font-semibold truncate"
                      >
                        {link.short_url}
                      </p>
                      <p
                        data-testid="recent-link-original-url"
                        className="text-gray-500 text-sm truncate"
                      >
                        {link.original_url}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs text-gray-500">Clicks</span>
                      <p
                        data-testid="recent-link-clicks"
                        className="text-lg font-bold text-gray-800"
                      >
                        {link.click_count}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/analytics/${link.slug}`}
                    className="mt-2 inline-block text-xs text-blue-600 hover:underline"
                  >
                    View Analytics
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
