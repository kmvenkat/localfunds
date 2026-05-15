import { useNavigate, useLocation, Navigate } from 'react-router-dom'

export default function Disambiguate() {
  const navigate = useNavigate()
  const location = useLocation()
  const geoResult = location.state?.geoResult

  if (!geoResult) {
    return <Navigate to="/" replace />
  }

  const zip = geoResult.zip

  function navigateToResults(selectedDistrict = null) {
    navigate(`/${geoResult.state}/${geoResult.county.slug}?type=county`, {
      state: {
        geoResult,
        ...(selectedDistrict ? { selectedDistrict } : {}),
      },
    })
  }

  function handleSelect(district) {
    navigateToResults(district)
  }

  function handleSkip() {
    navigateToResults()
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-bg px-6 pt-24">
      <h2 className="mb-2 text-center text-2xl font-bold text-ink">
        Which school district are you in?
      </h2>
      <p className="mb-8 text-center text-sm text-ink-light">
        ZIP {zip} spans more than one school district.
      </p>

      <div className="mx-auto w-full max-w-md space-y-3">
        {geoResult.districts.map((district) => (
          <button
            key={district.id}
            type="button"
            onClick={() => handleSelect(district)}
            className="group w-full rounded-xl border border-border bg-surface px-5 py-4 text-left transition-colors duration-150 hover:border-accent hover:bg-accent-lt"
          >
            <p className="text-sm font-semibold text-ink group-hover:text-accent">
              {district.name}
            </p>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSkip}
        className="mt-6 text-sm text-ink-light underline underline-offset-2 hover:text-ink"
      >
        Skip — just show me the county
      </button>
    </div>
  )
}
