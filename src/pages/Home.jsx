import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { resolveZip } from '../lib/geoResolver'

const EXAMPLE_ZIPS = ['77494', '10001', '60601']

const PREVIEW_CATEGORIES = [
  { label: 'Education & Children', amount: '$642.5M' },
  { label: 'Infrastructure & Environment', amount: '$1.6B' },
  { label: 'Housing & Community', amount: '$848.4M' },
]

export default function Home() {
  const [zip, setZip] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function handleSubmit(overrideZip) {
    const z = (overrideZip ?? zip).trim()
    if (z.length !== 5) {
      setError('Please enter a 5-digit ZIP code.')
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const geoResult = await resolveZip(z)

      if (geoResult.districts.length > 1) {
        navigate('/disambiguate', { state: { geoResult } })
      } else {
        navigate(`/${geoResult.state}/${geoResult.county.slug}?type=county`, {
          state: { geoResult },
        })
      }
    } catch (err) {
      if (err.message === 'ZIP_NOT_FOUND') {
        setError("We couldn't find that ZIP code. Please try again.")
      } else {
        setError('Something went wrong. Please try again in a moment.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-bg">
      <main className="mx-auto mt-24 w-full max-w-2xl px-6 sm:mt-32">
        <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-ink-light">
          Public data · Free · Nonpartisan
        </p>

        <h1 className="mb-4 text-center text-4xl font-bold leading-tight text-ink sm:text-5xl">
          See what federal funding
          <br />
          does for your community.
        </h1>

        <p className="mb-8 text-center text-base leading-relaxed text-ink-light sm:text-lg">
          Enter your ZIP code to explore federal dollars flowing into your community.
        </p>

        <div className="mx-auto w-full max-w-sm">
          <div className="flex gap-0 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="Enter ZIP code"
              value={zip}
              onChange={(e) => {
                setZip(e.target.value.replace(/\D/g, ''))
                if (error) setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              disabled={isLoading}
              className="flex-1 bg-transparent px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-light"
              aria-invalid={error ? 'true' : undefined}
            />
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isLoading}
              className="bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
            >
              {isLoading ? 'Looking up...' : 'Search'}
            </button>
          </div>

          {error && (
            <p className="mt-2 text-center text-xs text-cut" role="alert">
              {error}
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-ink-light">
          Try:{' '}
          {EXAMPLE_ZIPS.map((z, i) => (
            <span key={z}>
              <button
                type="button"
                onClick={() => {
                  setZip(z)
                  handleSubmit(z)
                }}
                disabled={isLoading}
                className="text-accent hover:underline disabled:opacity-60"
              >
                {z}
              </button>
              {i < 2 && <span className="mx-1 text-border">·</span>}
            </span>
          ))}
        </p>

        <div className="mx-auto mt-12 w-full max-w-2xl px-6 sm:mt-16">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-ink-light">Example</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 opacity-80 shadow-sm">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-light">
              Harris County, TX
            </p>
            <p className="mb-1 text-4xl font-bold text-ink">$3.9B</p>
            <p className="text-sm text-ink-light">
              in annual federal funding · roughly $820 per resident
            </p>

            <div className="mt-4 space-y-2">
              {PREVIEW_CATEGORIES.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between border-b border-border py-2 last:border-0"
                >
                  <span className="text-sm text-ink">{item.label}</span>
                  <span className="text-sm font-semibold text-accent">{item.amount}</span>
                </div>
              ))}
              <p className="pt-1 text-xs text-ink-light">+ 3 more categories</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
