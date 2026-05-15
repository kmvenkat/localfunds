import { useState } from 'react'
import { Link, useParams, useSearchParams, useLocation } from 'react-router-dom'
import {
  Construction,
  GraduationCap,
  HeartPulse,
  Home,
  ShieldCheck,
  Wheat,
} from 'lucide-react'
import AccordionRow from '../components/ui/AccordionRow.jsx'
import { formatBig } from '../lib/formatBig.js'
import {
  useCommunitySafety,
  useEducation,
  useFoodAndFarming,
  useHealth,
  useHousing,
  useInfrastructure,
} from '../hooks/useFunding.js'

const CATEGORIES = [
  {
    slug: 'education',
    label: 'Education & Children',
    icon: GraduationCap,
    query: null,
  },
  {
    slug: 'health',
    label: 'Health & Medicine',
    icon: HeartPulse,
    query: null,
  },
  {
    slug: 'infrastructure',
    label: 'Infrastructure & Environment',
    icon: Construction,
    query: null,
  },
  {
    slug: 'food-and-farming',
    label: 'Food & Farming',
    icon: Wheat,
    query: null,
  },
  {
    slug: 'housing',
    label: 'Housing & Community',
    icon: Home,
    query: null,
  },
  {
    slug: 'community-safety',
    label: 'Community Safety & Emergency',
    icon: ShieldCheck,
    query: null,
  },
]

function extractPopulation(queries) {
  for (const query of queries) {
    if (!query.data?.programs) continue
    for (const program of query.data.programs) {
      if (program.population && program.population > 0) {
        return program.population
      }
    }
  }
  return null
}

function heroGeographyLabel(type, geoResult, selectedDistrict) {
  if (type === 'city' && geoResult?.city?.name) return geoResult.city.name
  if (type === 'district') {
    return selectedDistrict?.name ?? geoResult?.districts?.[0]?.name ?? geoResult?.county?.name
  }
  return geoResult?.county?.name ?? ''
}

export default function Results() {
  const location = useLocation()
  const { state: stateCode } = useParams()
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type') ?? 'county'
  const geoResult = location.state?.geoResult ?? null
  const selectedDistrict = location.state?.selectedDistrict ?? null
  const countyFips = geoResult?.county?.fips

  const [openCategory, setOpenCategory] = useState(null)
  const [modalProgram, setModalProgram] = useState(null)
  const [copied, setCopied] = useState(false)

  const educationQuery = useEducation(countyFips, stateCode)
  const healthQuery = useHealth(countyFips, stateCode)
  const infraQuery = useInfrastructure(countyFips, stateCode)
  const foodQuery = useFoodAndFarming(countyFips, stateCode)
  const housingQuery = useHousing(countyFips, stateCode)
  const safetyQuery = useCommunitySafety(countyFips, stateCode)

  const categoryQueries = [
    educationQuery,
    healthQuery,
    infraQuery,
    foodQuery,
    housingQuery,
    safetyQuery,
  ]

  const categories = CATEGORIES.map((cat, i) => ({
    ...cat,
    query: categoryQueries[i],
  }))

  const anyLoading = categoryQueries.some((q) => q.isLoading)
  const grandTotal = categoryQueries.reduce((sum, q) => sum + (q.data?.total || 0), 0)
  const population = extractPopulation(categoryQueries)
  const perCapita = population ? Math.round(grandTotal / population) : null
  const geographyLabel = geoResult ? heroGeographyLabel(type, geoResult, selectedDistrict) : ''

  const handleOpenModal = (program) => {
    setModalProgram(program)
    console.log('open modal for:', program.name)
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative min-h-screen bg-bg">
      <div className="mx-auto max-w-[1280px] px-16">
        {!geoResult && (
          <p className="mt-8 text-ink-light">
            Enter a ZIP code on the home page to see funding data for this area.{' '}
            <Link to="/" className="font-semibold text-accent">
              Go to home
            </Link>
          </p>
        )}

        {geoResult && countyFips && (
          <>
            <header className="mb-2 mt-8">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-light">
                {geographyLabel}
              </p>
              {anyLoading ? (
                <div className="h-14 w-48 animate-pulse rounded bg-accent-lt" />
              ) : (
                <p className="text-6xl font-bold leading-none text-ink">{formatBig(grandTotal)}</p>
              )}
              {!anyLoading && (
                <>
                  <p className="mt-2 text-base text-ink-light">
                    in annual federal funding
                    {perCapita && (
                      <span> · roughly ${perCapita.toLocaleString()} per resident</span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={handleShare}
                    className={
                      copied
                        ? 'mt-3 flex items-center gap-1.5 rounded-lg border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors duration-150'
                        : 'mt-3 flex items-center gap-1.5 rounded-lg border border-accent bg-transparent px-3 py-1.5 text-xs font-medium text-accent transition-colors duration-150 hover:bg-accent-lt'
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    {copied ? 'Link copied!' : 'Copy link'}
                  </button>
                </>
              )}
            </header>

            <div className="mt-6 border-b border-border" />

            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              {categories.map((cat, i) => (
                <AccordionRow
                  key={cat.slug}
                  slug={cat.slug}
                  icon={cat.icon}
                  label={cat.label}
                  query={cat.query}
                  index={i}
                  isOpen={openCategory === cat.slug}
                  onToggle={() =>
                    setOpenCategory((prev) => (prev === cat.slug ? null : cat.slug))
                  }
                  onOpenModal={handleOpenModal}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {modalProgram && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(17, 20, 32, 0.35)' }}
          onClick={() => setModalProgram(null)}
          role="presentation"
        >
          <div
            className="relative w-full max-w-[480px] overflow-hidden rounded-2xl bg-surface shadow-2xl"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="methodology-title"
          >
            <div className="h-1 w-full bg-accent" />
            <button
              type="button"
              onClick={() => setModalProgram(null)}
              className="absolute top-4 right-4 text-lg leading-none text-ink-light hover:text-ink"
            >
              ✕
            </button>
            <div className="p-7">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                How we calculate this
              </p>
              <h3 id="methodology-title" className="mb-5 text-xl font-bold text-ink">
                {modalProgram.name}
              </h3>

              <div className="mb-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
                  Source
                </p>
                <p className="text-sm leading-relaxed text-ink">{modalProgram.source}</p>
              </div>

              <div className="mb-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
                  Geography
                </p>
                <p className="text-sm leading-relaxed text-ink">{modalProgram.geography}</p>
              </div>

              <div className="mb-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
                  Years covered
                </p>
                <p className="text-sm leading-relaxed text-ink">{modalProgram.vintage}</p>
              </div>

              {modalProgram.limitation && (
                <div className="mb-4">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
                    Limitation
                  </p>
                  <p className="text-sm leading-relaxed text-ink">{modalProgram.limitation}</p>
                </div>
              )}

              {modalProgram.sourceUrl && (
                <div className="mt-5 border-t border-border pt-4">
                  <a
                    href={modalProgram.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    View source data →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
