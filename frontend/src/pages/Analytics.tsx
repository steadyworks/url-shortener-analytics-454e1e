import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const BACKEND = 'http://localhost:3001'

interface ClickPoint {
  date: string
  count: number
}

interface Referrer {
  name: string
  count: number
}

interface GeoEntry {
  country: string
  count: number
}

interface AnalyticsData {
  slug: string
  original_url: string
  click_count: number
  clicks_over_time: ClickPoint[]
  referrers: Referrer[]
  geo: GeoEntry[]
}

export default function Analytics() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    fetch(`${BACKEND}/api/links/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then(setData)
      .catch(() => setError('Could not load analytics for this link.'))
  }, [slug])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error}</p>
          <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-blue-600 hover:underline text-sm">
            ← Back
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Analytics</h1>
        <p
          data-testid="analytics-slug"
          className="font-mono text-blue-700 mb-6 text-lg"
        >
          {BACKEND}/{slug}
        </p>

        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <p className="text-sm text-gray-500 mb-1">Total Clicks</p>
          <p
            data-testid="total-clicks"
            className="text-5xl font-bold text-gray-900"
          >
            {data.click_count}
          </p>
        </div>

        <div
          data-testid="clicks-chart"
          className="bg-white rounded-xl shadow p-6 mb-6"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Clicks Over Time</h2>
          {data.clicks_over_time.length === 0 ? (
            <p className="text-gray-400 text-sm">No click data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.clicks_over_time}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Top Referrers</h2>
            {data.referrers.length === 0 ? (
              <p className="text-gray-400 text-sm">No referrer data yet.</p>
            ) : (
              <div data-testid="referrers-list" className="space-y-2">
                {data.referrers.map((ref) => (
                  <div
                    key={ref.name}
                    data-testid="referrer-row"
                    className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0"
                  >
                    <span
                      data-testid="referrer-name"
                      className="text-sm text-gray-700 truncate"
                    >
                      {ref.name}
                    </span>
                    <span
                      data-testid="referrer-count"
                      className="text-sm font-semibold text-gray-900 ml-2 shrink-0"
                    >
                      {ref.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Geographic Breakdown</h2>
            {data.geo.length === 0 ? (
              <p className="text-gray-400 text-sm">No geographic data yet.</p>
            ) : (
              <div data-testid="geo-list" className="space-y-2">
                {data.geo.map((entry) => (
                  <div
                    key={entry.country}
                    data-testid="geo-row"
                    className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0"
                  >
                    <span
                      data-testid="geo-country"
                      className="text-sm text-gray-700"
                    >
                      {entry.country}
                    </span>
                    <span
                      data-testid="geo-count"
                      className="text-sm font-semibold text-gray-900 ml-2"
                    >
                      {entry.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
