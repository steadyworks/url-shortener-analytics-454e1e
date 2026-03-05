export default function Expired() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center p-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Link Unavailable</h1>
        <p
          data-testid="expired-message"
          className="text-lg text-gray-600"
        >
          This link has expired or does not exist.
        </p>
        <a
          href="/"
          className="mt-6 inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          Create a new link
        </a>
      </div>
    </div>
  )
}
