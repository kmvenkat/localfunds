const USASPENDING_AWARDS = 'https://api.usaspending.gov/api/v2/search/spending_by_award/'
const USASPENDING_GEOGRAPHY = 'https://api.usaspending.gov/api/v2/search/spending_by_geography/'

const VINTAGE = 'Awards from FY2015 through FY2024.'

const URBAN_FINANCE_SOURCE =
  'Urban Institute Education Data Portal — CCD District Finance (NCES)'

const URBAN_FINANCE_VINTAGE =
  'FY2019 (most recent available in Urban Institute CCD Finance dataset).'

const SNAP_ESTIMATED_LIMITATION =
  'County figure estimated from national SNAP participation rates. Actual disbursements are state-administered and not reported at county level by USDA.'

const WIC_ESTIMATED_LIMITATION =
  'County figure estimated from national WIC participation rates. Actual disbursements are state-administered and not reported at county level by USDA.'

const STATE_ABBR_TO_FIPS = {
  al: '01',
  ak: '02',
  az: '04',
  ar: '05',
  ca: '06',
  co: '08',
  ct: '09',
  de: '10',
  dc: '11',
  fl: '12',
  ga: '13',
  hi: '15',
  id: '16',
  il: '17',
  in: '18',
  ia: '19',
  ks: '20',
  ky: '21',
  la: '22',
  me: '23',
  md: '24',
  ma: '25',
  mi: '26',
  mn: '27',
  ms: '28',
  mo: '29',
  mt: '30',
  ne: '31',
  nv: '32',
  nh: '33',
  nj: '34',
  nm: '35',
  ny: '36',
  nc: '37',
  nd: '38',
  oh: '39',
  ok: '40',
  or: '41',
  pa: '42',
  ri: '44',
  sc: '45',
  sd: '46',
  tn: '47',
  tx: '48',
  ut: '49',
  vt: '50',
  va: '51',
  wa: '53',
  wv: '54',
  wi: '55',
  wy: '56',
  pr: '72',
}

/** @returns {string | null} Five-digit county FIPS from geoResult */
export function getCountyFips(geoResult) {
  return geoResult?.county?.fips ?? null
}

/** @returns {string | null} Two-digit state FIPS */
export function resolveStateFips(stateCode) {
  if (!stateCode) return null
  return STATE_ABBR_TO_FIPS[stateCode.toLowerCase()] ?? null
}

function toStateAbbr(stateCode) {
  return stateCode?.toUpperCase() ?? ''
}

function splitCountyFips(countyFips) {
  const stateFips = countyFips.slice(0, 2)
  const countyCode = countyFips.slice(2)
  return { stateFips, countyCode }
}

function sumNumbers(values) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0)
}

const GRANT_AWARD_TYPES = ['02', '03', '04', '05']

function buildUSASpendingQuery(stateCode, countyCode, cfdaNumbers) {
  return {
    filters: {
      award_type_codes: GRANT_AWARD_TYPES,
      program_numbers: cfdaNumbers,
      place_of_performance_locations: [
        { country: 'USA', state: stateCode, county: countyCode },
      ],
      time_period: [{ start_date: '2015-01-01', end_date: '2025-12-31' }],
    },
    fields: ['Award Amount', 'Recipient Name', 'Award ID'],
    subawards: false,
    limit: 100,
  }
}

function logUSASpendingResults(programName, data, label = 'USASpending') {
  console.log(`[api] ${label} ${programName} response:`, data)
  console.log(
    `[api] ${programName}: ${data.results?.length ?? 0} results, total awards: ${data.page_metadata?.total ?? 0}`,
  )
}

async function fetchUSASpending(stateCode, countyCode, cfdaNumbers, programName) {
  const response = await fetch(USASPENDING_AWARDS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildUSASpendingQuery(stateCode, countyCode, cfdaNumbers)),
  })

  if (!response.ok) {
    throw new Error(`USASpending: HTTP ${response.status}`)
  }

  const data = await response.json()
  logUSASpendingResults(programName, data)

  if (data.page_metadata?.total > 100) {
    console.warn(`${programName}: ${data.page_metadata.total} awards found, showing first 100 only`)
  }

  return data.results?.reduce((sum, row) => sum + (row['Award Amount'] || 0), 0) || 0
}

async function fetchByGeography(countyFips, cfdaNumbers, programName) {
  const response = await fetch(USASPENDING_GEOGRAPHY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'place_of_performance',
      geo_layer: 'county',
      geo_layer_filters: [countyFips],
      filters: {
        program_numbers: cfdaNumbers,
        time_period: [{ start_date: '2015-01-01', end_date: '2024-12-31' }],
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`USASpending geography: HTTP ${response.status}`)
  }

  const data = await response.json()
  console.log(`[geo] ${programName} response:`, data)
  const amount = data.results?.[0]?.aggregated_amount ?? 0
  const population = data.results?.[0]?.population ?? null
  console.log(`[geo] ${programName}: $${amount.toLocaleString()}`)
  return { amount, population }
}

async function fetchByRecipientLocation(countyFips, cfdaNumbers, programName) {
  const response = await fetch(USASPENDING_GEOGRAPHY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'recipient_location',
      geo_layer: 'county',
      geo_layer_filters: [countyFips],
      filters: {
        program_numbers: cfdaNumbers,
        time_period: [{ start_date: '2015-01-01', end_date: '2024-12-31' }],
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`USASpending recipient geography: HTTP ${response.status}`)
  }

  const data = await response.json()
  const amount = data.results?.[0]?.aggregated_amount ?? 0
  const population = data.results?.[0]?.population ?? null
  console.log(`[geo-recip] ${programName}: $${amount.toLocaleString()}`)
  return { amount, population }
}

async function fetchCountyPopulation(countyFips) {
  try {
    const stateFips = countyFips.slice(0, 2)
    const countyCode = countyFips.slice(2)
    const response = await fetch(
      `https://api.census.gov/data/2022/pep/population?get=POP_2022&for=county:${countyCode}&in=state:${stateFips}`,
    )
    const data = await response.json()
    const pop = parseInt(data[1][0], 10)
    console.log(`[pop] County population for ${countyFips}: ${pop.toLocaleString()}`)
    return pop
  } catch (error) {
    console.warn('[pop] Census PEP failed, using fallback:', error.message)
    return 100000
  }
}

function buildSnapProgram(population) {
  const snapEstimate = Math.round(population * 0.12 * 1020)
  console.log(
    `[api] SNAP estimated: $${snapEstimate.toLocaleString()} (population: ${population.toLocaleString()})`,
  )

  return {
    ...baseProgram({
      id: 'snap',
      name: 'SNAP',
      description: 'Nutrition assistance for low-income individuals and families.',
      source: 'USDA Food and Nutrition Service — estimated from national participation rates',
      geography:
        'Estimated from county population and national SNAP participation and benefit rates. Not a direct federal award figure.',
      vintage: 'FY2023 participation rates applied to current county population.',
      limitation: SNAP_ESTIMATED_LIMITATION,
      estimated: true,
      sourceUrl: 'https://www.fns.usda.gov/pd/supplemental-nutrition-assistance-program-data',
    }),
    amount: snapEstimate,
    status: 'estimated',
    population,
  }
}

function buildWicProgram(population) {
  const wicParticipants = Math.round(population * 0.06 * 0.08 + population * 0.2 * 0.03)
  const wicEstimate = Math.round(wicParticipants * 60 * 12)
  console.log(
    `[api] WIC estimated: $${wicEstimate.toLocaleString()} (population: ${population.toLocaleString()})`,
  )

  return {
    ...baseProgram({
      id: 'wic',
      name: 'WIC',
      description: 'Nutrition support for low-income women, infants, and children.',
      source: 'USDA Food and Nutrition Service — estimated from national participation rates',
      geography:
        'Estimated from county population and national WIC participation and benefit rates. Not a direct federal award figure.',
      vintage: 'FY2023 participation rates applied to current county population.',
      limitation: WIC_ESTIMATED_LIMITATION,
      estimated: true,
      sourceUrl: 'https://www.fns.usda.gov/pd/wic-program',
    }),
    amount: wicEstimate,
    status: 'estimated',
  }
}

function failedProgram(program, errorMessage) {
  return {
    ...program,
    amount: 0,
    population: null,
    limitation: `Data unavailable: ${errorMessage}`,
  }
}

function baseProgram({
  id,
  name,
  description,
  source,
  geography,
  limitation = null,
  estimated = false,
  sourceUrl,
  noDataReason = null,
  noDataLink = null,
  noDataLinkLabel = null,
  vintage = VINTAGE,
}) {
  return {
    id,
    name,
    amount: 0,
    status: estimated ? 'estimated' : 'active',
    estimated,
    description,
    source,
    geography,
    vintage,
    limitation,
    population: null,
    sourceUrl,
    noDataReason,
    noDataLink,
    noDataLinkLabel,
  }
}

function resolveCountyParams(countyFips, stateCode) {
  const stateAbbr = toStateAbbr(stateCode)
  const resolvedStateFips = resolveStateFips(stateCode)

  if (!countyFips || countyFips.length !== 5 || !resolvedStateFips) {
    return null
  }

  const { stateFips, countyCode } = splitCountyFips(countyFips)

  if (stateFips !== resolvedStateFips) {
    console.warn(
      `[api] County FIPS state prefix (${stateFips}) does not match state code (${stateCode})`,
    )
  }

  return { stateAbbr, countyCode }
}

async function fetchProgram(stateAbbr, countyCode, program, cfdaNumbers) {
  try {
    program.amount = await fetchUSASpending(stateAbbr, countyCode, cfdaNumbers, program.name)
    program.population = null
    return program
  } catch (err) {
    return failedProgram(program, err.message)
  }
}

async function fetchGeographyProgram(countyFips, program, cfdaNumbers) {
  try {
    const { amount, population } = await fetchByGeography(countyFips, cfdaNumbers, program.name)
    program.amount = amount
    program.population = population ?? null
    return { program, population }
  } catch (err) {
    return { program: failedProgram(program, err.message), population: null }
  }
}

async function fetchRecipientGeographyProgram(countyFips, program, cfdaNumbers) {
  try {
    const { amount, population } = await fetchByRecipientLocation(
      countyFips,
      cfdaNumbers,
      program.name,
    )
    program.amount = amount
    program.population = population ?? null
    return { program, population }
  } catch (err) {
    return { program: failedProgram(program, err.message), population: null }
  }
}

const URBAN_BASE = 'https://educationdata.urban.org/api/v1'

async function fetchDistrictFinance(countyFips) {
  try {
    const stateFips = parseInt(countyFips.slice(0, 2), 10)

    const dirUrl = `${URBAN_BASE}/school-districts/ccd/directory/2021/?fips=${stateFips}&per_page=2000`
    const dirRes = await fetch(dirUrl)
    if (!dirRes.ok) throw new Error(`Urban directory: ${dirRes.status}`)
    const dirData = await dirRes.json()

    const countyDistricts = (dirData.results ?? []).filter(
      (r) => String(r.county_code) === String(countyFips),
    )

    console.log(`[urban] ${countyDistricts.length} districts in county ${countyFips}`)

    if (countyDistricts.length === 0) return { titleI: 0, idea: 0, schoolLunch: 0 }

    const leaids = countyDistricts.map((r) => r.leaid).filter(Boolean)

    const financePromises = leaids.slice(0, 100).map((leaid) =>
      fetch(`${URBAN_BASE}/school-districts/ccd/finance/2019/?leaid=${leaid}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d) => d.results?.[0] ?? {})
        .catch(() => ({})),
    )
    const financeResults = await Promise.all(financePromises)

    const titleI = financeResults.reduce((sum, r) => sum + (r.rev_fed_state_title_i ?? 0), 0)
    const idea = financeResults.reduce((sum, r) => sum + (r.rev_fed_state_idea ?? 0), 0)
    const schoolLunch = financeResults.reduce((sum, r) => sum + (r.rev_fed_child_nutrition_act ?? 0), 0)

    console.log(
      `[urban] Title I: $${Math.round(titleI / 1e6)}M IDEA: $${Math.round(idea / 1e6)}M Lunch: $${Math.round(schoolLunch / 1e6)}M`,
    )
    return { titleI, idea, schoolLunch }
  } catch (e) {
    console.warn('[urban] fetchDistrictFinance failed:', e.message)
    return { titleI: 0, idea: 0, schoolLunch: 0 }
  }
}

function resolveEducationGeoResult(geoResult, template) {
  if (geoResult.status === 'fulfilled') {
    return geoResult.value
  }
  return {
    program: failedProgram(template, geoResult.reason?.message ?? 'Request failed'),
    population: null,
  }
}

function applyDistrictFinanceProgram(program, amount) {
  return {
    ...program,
    amount,
  }
}

async function fetchAgExtensionProgram(countyFips, stateAbbr, countyCode, program) {
  const cfda = ['10.500']

  try {
    const { amount, population } = await fetchByGeography(countyFips, cfda, program.name)
    program.population = population ?? null

    if (amount > 0) {
      console.log('[ag-ext] using geography result:', amount)
      program.amount = amount
      return { program, population }
    }

    console.log('[ag-ext] geography empty, falling back to awards')
    program.amount = await fetchUSASpending(stateAbbr, countyCode, cfda, program.name)
    return { program, population }
  } catch (err) {
    return { program: failedProgram(program, err.message), population: null }
  }
}

function populationFromGeographyResults(geoResults) {
  for (const result of geoResults) {
    if (result.status === 'fulfilled' && result.value.population != null) {
      return result.value.population
    }
  }
  return null
}

async function fetchCategory(countyFips, stateCode, programDefs) {
  const params = resolveCountyParams(countyFips, stateCode)
  if (!params) {
    return { total: 0, programs: [] }
  }

  const { stateAbbr, countyCode } = params

  const results = await Promise.allSettled(
    programDefs.map(({ cfda, program }) =>
      fetchProgram(stateAbbr, countyCode, program, cfda),
    ),
  )

  const programs = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    }
    return failedProgram(
      programDefs[index].program,
      result.reason?.message ?? 'Request failed',
    )
  })

  return {
    total: sumNumbers(programs.map((p) => p.amount)),
    programs,
  }
}

function withDataNote(result, dataNote) {
  return { ...result, dataNote }
}

const DATA_NOTES = {
  education: {
    zero:
      'Education grants often flow through state agencies and may not appear at county level in federal spending data. Your county likely receives Title I, IDEA, and school lunch funding — search your school district by name at USASpending.gov for details.',
    partial:
      "Some education programs aren't tracked at county level and may not be reflected in this total.",
  },
  health: {
    zero:
      'Health funding often flows through state Medicaid agencies and may not appear at county level. Your county almost certainly receives Medicaid and other health funding — this reflects a data limitation, not an absence of funding.',
    medicaid:
      'Medicaid disbursements flow through state agencies and may not be fully reflected at county level.',
  },
  infrastructure: {
    zero:
      'Infrastructure funding may not be captured here if no direct federal awards were made to your county in the years covered. Highway formula funds flow through state DOTs and are not included.',
  },
  foodAndFarming: {
    estimated:
      'SNAP and WIC figures are estimated from county population and national participation rates. Farm program figures reflect direct federal awards where available.',
    zero:
      'Food and farming programs are largely state-administered and may not appear at county level in federal spending data.',
  },
  housing: {
    zero:
      'Housing grants may not appear here if your county is not an HUD entitlement community. Funding may flow through your state housing agency instead.',
  },
  communitySafety: {
    zero:
      'No federal safety and emergency grants were recorded for this county in the years covered. Smaller counties may receive these funds through state pass-through grants not captured here.',
  },
}

function educationDataNote(total, programs, hasDistrictFinance = false) {
  if (total === 0) return DATA_NOTES.education.zero
  if (hasDistrictFinance) {
    return 'Title I, IDEA, and School Lunch figures reflect district finance reports via the Urban Institute Education Data Portal (FY2019). Head Start and Pell Grant figures reflect direct federal awards.'
  }
  if (total > 0) {
    const titleI = programs.find((p) => p.id === 'title-i')
    const idea = programs.find((p) => p.id === 'idea')
    const schoolLunch = programs.find((p) => p.id === 'school-lunch')
    if (
      titleI?.amount === 0 &&
      idea?.amount === 0 &&
      schoolLunch?.amount === 0
    ) {
      return 'Title I, IDEA, and School Lunch flow through state agencies and may not appear at county level. Pell Grants and Head Start reflect direct recipient data.'
    }
  }
  return null
}

function healthDataNote(total, programs) {
  if (total === 0) return DATA_NOTES.health.zero
  const medicaid = programs.find((p) => p.id === 'medicaid')
  if (total > 0 && medicaid?.amount === 0) return DATA_NOTES.health.medicaid
  return null
}

function infrastructureDataNote(total) {
  if (total === 0) return DATA_NOTES.infrastructure.zero
  return null
}

function foodAndFarmingDataNote(total, programs) {
  if (total === 0) return DATA_NOTES.foodAndFarming.zero
  if (programs.some((p) => p.estimated)) return DATA_NOTES.foodAndFarming.estimated
  return null
}

function housingDataNote(total) {
  if (total === 0) return DATA_NOTES.housing.zero
  return null
}

function communitySafetyDataNote(total) {
  if (total === 0) return DATA_NOTES.communitySafety.zero
  return null
}

export async function fetchCommunitySafety(countyFips, stateCode) {
  const result = await fetchCategory(countyFips, stateCode, [
    {
      cfda: ['97.039'],
      program: baseProgram({
        id: 'fema-hazard-mitigation',
        name: 'Hazard Mitigation Grants',
        description:
          'Federal grants to reduce risk from natural disasters including floods, hurricanes, and wildfires.',
        source: 'USASpending.gov — CFDA 97.039 Hazard Mitigation Grant',
        geography: 'Attributed to county of place of performance.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=97.039',
        noDataReason:
          'Hazard mitigation grants are project-based and may not have active awards in every county in every period.',
        noDataLink: 'https://www.fema.gov/grants/mitigation',
        noDataLinkLabel: 'Find FEMA mitigation grants at fema.gov →',
      }),
    },
    {
      cfda: ['97.036'],
      program: baseProgram({
        id: 'fema-public-assistance',
        name: 'FEMA Public Assistance',
        description:
          'Reimbursement to local governments for disaster response, debris removal, and infrastructure repair.',
        source: 'USASpending.gov — CFDA 97.036 Disaster Grants — Public Assistance',
        geography: 'Disaster-specific. Only awarded after a presidentially declared disaster.',
        limitation:
          'Covers declared disasters only. Routine emergency management funding tracked separately.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=97.036',
        noDataReason:
          'FEMA Public Assistance is disaster-specific. Counties only receive this funding after a presidentially declared disaster.',
        noDataLink: 'https://www.fema.gov/assistance/public',
        noDataLinkLabel: 'Find FEMA Public Assistance data at fema.gov →',
      }),
    },
    {
      cfda: ['16.738'],
      program: baseProgram({
        id: 'byrne-jag',
        name: 'Byrne JAG Grants',
        description:
          'Federal grants supporting local law enforcement, crime prevention, and criminal justice programs.',
        source: 'USASpending.gov — CFDA 16.738 Edward Byrne Memorial Justice Assistance Grant',
        geography: 'Attributed to county of the recipient law enforcement agency.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=16.738',
      }),
    },
    {
      cfda: ['97.044'],
      program: baseProgram({
        id: 'fema-afg',
        name: 'Fire Department Grants (AFG)',
        description:
          'Grants to fire departments for equipment, training, and operations to protect communities.',
        source: 'USASpending.gov — CFDA 97.044 Assistance to Firefighters Grant',
        geography: 'Attributed to county of the recipient fire department.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=97.044',
      }),
    },
    {
      cfda: ['64.024', '64.025'],
      program: baseProgram({
        id: 'veterans-services',
        name: 'Veterans Services Grants',
        description:
          'Grants supporting housing, employment, and community services for veterans.',
        source: 'USASpending.gov — CFDA 64.024 Veterans State Domiciliary Care',
        geography: 'Attributed to county of the recipient organization.',
        limitation:
          'Does not include VA healthcare or disability payments tracked separately.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=64.024',
      }),
    },
  ])
  return withDataNote(result, communitySafetyDataNote(result.total))
}

export async function fetchEducation(countyFips, stateCode) {
  const params = resolveCountyParams(countyFips, stateCode)
  if (!params) {
    return withDataNote({ total: 0, programs: [] }, DATA_NOTES.education.zero)
  }

  const titleIProgram = baseProgram({
    id: 'title-i',
    name: 'Title I',
    description: 'Funding for schools serving high concentrations of low-income students.',
    source: URBAN_FINANCE_SOURCE,
    geography: 'Sum of federal Title I revenue reported by all school districts in this county.',
    vintage: URBAN_FINANCE_VINTAGE,
    sourceUrl: 'https://sam.gov/search?index=cfda&q=84.010',
    noDataReason:
      'Title I grants flow through the Texas Education Agency (TEA), a state agency. USASpending tracks the award to the state, not to individual counties or districts.',
    noDataLink:
      'https://tea.texas.gov/finance-and-grants/grants/grants-administration/applying-for-a-grant',
    noDataLinkLabel: 'Find Title I data at tea.texas.gov →',
  })

  const ideaProgram = baseProgram({
    id: 'idea',
    name: 'Special Education (IDEA)',
    description: 'Grants supporting education for students with disabilities.',
    source: URBAN_FINANCE_SOURCE,
    geography: 'Sum of federal IDEA revenue reported by all school districts in this county.',
    vintage: URBAN_FINANCE_VINTAGE,
    sourceUrl: 'https://sam.gov/search?index=cfda&q=84.027',
    noDataReason:
      "IDEA grants are administered by TEA and distributed to school districts. County-level data isn't tracked in federal spending systems.",
    noDataLink: 'https://tea.texas.gov/academics/special-student-populations/special-education',
    noDataLinkLabel: 'Find IDEA data at tea.texas.gov →',
  })

  const schoolLunchProgram = baseProgram({
    id: 'school-lunch',
    name: 'School Lunch Program',
    description: 'Federal reimbursements to schools for free and reduced-price meals.',
    source: URBAN_FINANCE_SOURCE,
    geography:
      'Sum of federal child nutrition revenue reported by all school districts in this county.',
    vintage: URBAN_FINANCE_VINTAGE,
    sourceUrl: 'https://sam.gov/search?index=cfda&q=10.555',
    noDataReason:
      "School lunch reimbursements flow through TEA to individual school districts. USASpending doesn't capture county-level disbursements.",
    noDataLink: 'https://www.fns.usda.gov/nslp',
    noDataLinkLabel: 'Find School Lunch data at fns.usda.gov →',
  })

  const headStartProgram = baseProgram({
    id: 'head-start',
    name: 'Head Start',
    description: 'Early childhood education, health, and nutrition for low-income children.',
    source: 'USASpending.gov — CFDA 93.600 Head Start',
    geography: 'Attributed to county of the recipient organization.',
    sourceUrl: 'https://sam.gov/search?index=cfda&q=93.600',
  })

  const pellProgram = baseProgram({
    id: 'pell-grants',
    name: 'Pell Grants',
    description: 'Need-based grants for undergraduate students at colleges in this county.',
    source: 'USASpending.gov — CFDA 84.063 Federal Pell Grant Program',
    geography: 'Attributed to county of the recipient institution.',
    limitation:
      'Reflects grants to institutions located in this county. Students may commute from other counties.',
    sourceUrl: 'https://sam.gov/search?index=cfda&q=84.063',
  })

  const chipProgram = baseProgram({
    id: 'chip',
    name: 'CHIP',
    description: 'Health insurance coverage for children in low-income families.',
    source: "USASpending.gov — CFDA 93.767 Children's Health Insurance Program",
    geography: 'Attributed to county of the recipient organization.',
    limitation: 'State-administered program. County attribution is approximate.',
    sourceUrl: 'https://sam.gov/search?index=cfda&q=93.767',
  })

  const templates = [
    titleIProgram,
    ideaProgram,
    schoolLunchProgram,
    headStartProgram,
    pellProgram,
    chipProgram,
  ]

  const [geoResults, districtFinance] = await Promise.all([
    Promise.allSettled([
      fetchRecipientGeographyProgram(countyFips, titleIProgram, ['84.010']),
      fetchRecipientGeographyProgram(countyFips, ideaProgram, ['84.027']),
      fetchRecipientGeographyProgram(countyFips, schoolLunchProgram, ['10.555']),
      fetchRecipientGeographyProgram(countyFips, headStartProgram, ['93.600']),
      fetchRecipientGeographyProgram(countyFips, pellProgram, ['84.063']),
      fetchRecipientGeographyProgram(countyFips, chipProgram, ['93.767']),
    ]),
    fetchDistrictFinance(countyFips),
  ])

  const [titleIGeo, ideaGeo, schoolLunchGeo, headStartGeo, pellGeo, chipGeo] = geoResults.map(
    (result, index) => resolveEducationGeoResult(result, templates[index]),
  )

  const titleIAmount =
    districtFinance.titleI > 0 ? districtFinance.titleI : titleIGeo.program.amount
  const ideaAmount = districtFinance.idea > 0 ? districtFinance.idea : ideaGeo.program.amount
  const schoolLunchAmount =
    districtFinance.schoolLunch > 0 ? districtFinance.schoolLunch : schoolLunchGeo.program.amount

  const headStart = headStartGeo.program
  const pellGrants = pellGeo.program
  const chip = chipGeo.program

  const programs = [
    applyDistrictFinanceProgram(titleIGeo.program, titleIAmount, districtFinance.titleI > 0),
    applyDistrictFinanceProgram(ideaGeo.program, ideaAmount, districtFinance.idea > 0),
    applyDistrictFinanceProgram(
      schoolLunchGeo.program,
      schoolLunchAmount,
      districtFinance.schoolLunch > 0,
    ),
    { ...headStart, amount: headStart.amount },
    { ...pellGrants, amount: pellGrants.amount },
    { ...chip, amount: chip.amount },
  ]

  const population =
    titleIGeo.population ??
    ideaGeo.population ??
    headStartGeo.population ??
    pellGeo.population ??
    null

  const pell = programs.find((p) => p.id === 'pell-grants')
  if (pell) {
    pell.population = population
  }

  const hasDistrictFinance =
    districtFinance.titleI > 0 || districtFinance.idea > 0 || districtFinance.schoolLunch > 0

  const total = sumNumbers(programs.map((p) => p.amount))
  return withDataNote(
    { total, programs },
    educationDataNote(total, programs, hasDistrictFinance),
  )
}

export async function fetchHealth(countyFips, stateCode) {
  const result = await fetchCategory(countyFips, stateCode, [
    {
      cfda: ['93.778'],
      program: baseProgram({
        id: 'medicaid',
        name: 'Medicaid',
        description:
          'Federal-state health insurance for low-income individuals and families.',
        source: 'USASpending.gov — CFDA 93.778 Medical Assistance Program',
        geography:
          'Attributed to county of the administering state Medicaid agency. County attribution is approximate.',
        limitation: 'State-administered program. County attribution is approximate.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=93.778',
        noDataReason:
          'Medicaid is jointly funded federally and by states. Payments flow through Texas HHSC — a state agency — not to individual counties. USASpending tracks the state-level award only.',
        noDataLink:
          'https://www.medicaid.gov/medicaid/financial-management/medicaid-expenditure-analysis/index.html',
        noDataLinkLabel: 'Find Medicaid expenditure data at medicaid.gov →',
      }),
    },
    {
      cfda: ['93.912'],
      program: baseProgram({
        id: 'rural-health',
        name: 'Rural Health Grants',
        description: 'Grants supporting healthcare access and workforce in rural communities.',
        source: 'USASpending.gov — CFDA 93.912 Rural Health Care Services',
        geography: 'Attributed to county of the recipient organization.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=93.912',
        noDataReason:
          'Rural health grants are administered through state offices and may not appear at county level for urban counties like this one.',
        noDataLink: 'https://www.hrsa.gov/rural-health',
        noDataLinkLabel: 'Find rural health data at hrsa.gov →',
      }),
    },
    {
      cfda: ['93.224'],
      program: baseProgram({
        id: 'community-health-centers',
        name: 'Community Health Centers',
        description: 'Funding for community health centers serving underserved populations.',
        source: 'USASpending.gov — CFDA 93.224 Community Health Centers',
        geography: 'Attributed to county of the recipient health center.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=93.224',
      }),
    },
    {
      cfda: ['64.009'],
      program: baseProgram({
        id: 'va-healthcare',
        name: 'VA Healthcare',
        description: 'Veterans healthcare services and facility operations in this county.',
        source: 'Department of Veterans Affairs — not tracked in USASpending',
        geography:
          'VA operates through its own facility network and does not report to USASpending.',
        vintage: 'N/A',
        limitation: 'Includes facility-based care. Not all veteran residents are served locally.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=64.009',
        noDataReason:
          "VA healthcare runs through the Department of Veterans Affairs' own facility network, not through USASpending award grants. VA expenditure data is published separately.",
        noDataLink: 'https://www.va.gov/directory/guide/home.asp',
        noDataLinkLabel: 'Find VA facilities and data at va.gov →',
      }),
    },
    {
      cfda: ['93.958'],
      program: baseProgram({
        id: 'mental-health',
        name: 'Mental Health Services',
        description: 'Grants for community mental health services and treatment programs.',
        source: 'USASpending.gov — CFDA 93.958 Block Grants for Community Mental Health',
        geography: 'Attributed to county of the recipient organization.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=93.958',
      }),
    },
    {
      cfda: ['93.959'],
      program: baseProgram({
        id: 'substance-abuse',
        name: 'Substance Abuse Treatment',
        description: 'Grants for substance abuse prevention and treatment services.',
        source: 'USASpending.gov — CFDA 93.959 Block Grants for Prevention and Treatment',
        geography: 'Attributed to county of the recipient organization.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=93.959',
        noDataReason:
          "Substance abuse treatment grants are administered by SAMHSA through state behavioral health agencies. County-level data isn't tracked in USASpending.",
        noDataLink: 'https://www.samhsa.gov/data/',
        noDataLinkLabel: 'Find behavioral health data at samhsa.gov →',
      }),
    },
  ])
  return withDataNote(result, healthDataNote(result.total, result.programs))
}

export async function fetchInfrastructure(countyFips, stateCode) {
  const result = await fetchCategory(countyFips, stateCode, [
    {
      cfda: ['20.205'],
      program: baseProgram({
        id: 'highway',
        name: 'Highway Planning and Construction',
        description: 'Federal highway funding for road construction, repair, and planning.',
        source: 'USASpending.gov — CFDA 20.205 Highway Planning and Construction',
        geography: 'Attributed to county of place of performance.',
        limitation:
          'Reflects project-level obligations. Formula allocations to states are not included.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=20.205',
      }),
    },
    {
      cfda: ['20.507'],
      program: baseProgram({
        id: 'transit',
        name: 'Transit Grants',
        description: 'Federal grants for public transit systems, buses, and rail.',
        source: 'USASpending.gov — CFDA 20.507 Formula Grants for Rural Areas',
        geography: 'Attributed to county of place of performance.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=20.507',
      }),
    },
    {
      cfda: ['10.888'],
      program: baseProgram({
        id: 'broadband',
        name: 'Broadband Infrastructure',
        description: 'Grants to expand high-speed internet access in underserved areas.',
        source: 'USASpending.gov — CFDA 10.888 Rural Broadband Access',
        geography: 'Attributed to county of place of performance.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=10.888',
      }),
    },
    {
      cfda: ['66.458'],
      program: baseProgram({
        id: 'water-wastewater',
        name: 'Water and Wastewater',
        description: 'Grants for drinking water and wastewater infrastructure improvements.',
        source: 'USASpending.gov — CFDA 66.458 Capitalization Grants for Clean Water',
        geography: 'Attributed to county of place of performance.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=66.458',
      }),
    },
    {
      cfda: ['66.460'],
      program: baseProgram({
        id: 'epa-clean-water',
        name: 'EPA Clean Water Grants',
        description: 'EPA grants to protect and restore local waterways and ecosystems.',
        source: 'USASpending.gov — CFDA 66.460 Clean Water State Revolving Fund',
        geography: 'Attributed to county of place of performance.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=66.460',
      }),
    },
    {
      cfda: ['66.802'],
      program: baseProgram({
        id: 'env-remediation',
        name: 'Environmental Remediation',
        description: 'Funding to clean up contaminated sites and protect community health.',
        source: 'USASpending.gov — CFDA 66.802 Superfund State and Indian Tribe Core Program',
        geography: 'Attributed to county of place of performance.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=66.802',
      }),
    },
  ])
  return withDataNote(result, infrastructureDataNote(result.total))
}

export async function fetchFoodAndFarming(countyFips, stateCode) {
  const params = resolveCountyParams(countyFips, stateCode)
  if (!params) {
    return withDataNote(
      { total: 0, programs: [] },
      DATA_NOTES.foodAndFarming.zero,
    )
  }

  const { stateAbbr, countyCode } = params

  const farmLoansProgram = baseProgram({
    id: 'farm-loans',
    name: 'Farm Operating Loans',
    description: 'USDA loans and grants supporting farm operations and family farmers.',
    source: 'USASpending.gov — CFDA 10.406 Farm Operating Loans',
    geography: 'Attributed to county of place of performance.',
    sourceUrl: 'https://sam.gov/search?index=cfda&q=10.406',
  })

  const agExtensionProgram = baseProgram({
    id: 'ag-extension',
    name: 'Agricultural Extension',
    description: 'USDA funding for university extension programs supporting local farmers.',
    source: 'USASpending.gov — CFDA 10.500 Cooperative Extension Service',
    geography: 'Attributed to county of place of performance.',
    sourceUrl: 'https://sam.gov/search?index=cfda&q=10.500',
  })

  const cropInsuranceProgram = baseProgram({
    id: 'crop-insurance',
    name: 'Crop Insurance',
    description: 'Federal support for crop insurance protecting farmers from weather losses.',
    source: 'USDA Risk Management Agency — Summary of Business data',
    geography: 'Reported at county level by USDA RMA.',
    vintage: 'Most recent available RMA Summary of Business data.',
    sourceUrl: 'https://www.rma.usda.gov/en/Information-Tools/Summary-of-Business',
  })

  const farmGeoResults = await Promise.allSettled([
    fetchGeographyProgram(countyFips, farmLoansProgram, ['10.406']),
    fetchAgExtensionProgram(countyFips, stateAbbr, countyCode, agExtensionProgram),
    fetchGeographyProgram(countyFips, cropInsuranceProgram, ['10.450', '10.195']),
  ])

  let population = populationFromGeographyResults(farmGeoResults)
  if (!population) {
    population = await fetchCountyPopulation(countyFips)
  }

  const resolvedFarmPrograms = farmGeoResults.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value.program
    }
    const templates = [farmLoansProgram, agExtensionProgram, cropInsuranceProgram]
    return failedProgram(templates[index], result.reason?.message ?? 'Request failed')
  })

  const programs = [
    buildSnapProgram(population),
    buildWicProgram(population),
    ...resolvedFarmPrograms,
  ]

  const total = sumNumbers(programs.map((p) => p.amount))
  return withDataNote(
    { total, programs },
    foodAndFarmingDataNote(total, programs),
  )
}

export async function fetchHousing(countyFips, stateCode) {
  const result = await fetchCategory(countyFips, stateCode, [
    {
      cfda: ['14.218'],
      program: baseProgram({
        id: 'cdbg',
        name: 'Community Development Block Grants',
        description:
          'Flexible federal grants for community development, housing, and local improvements.',
        source: 'USASpending.gov — CFDA 14.218 Community Development Block Grants',
        geography: 'Attributed to county of the recipient jurisdiction.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=14.218',
      }),
    },
    {
      cfda: ['14.871'],
      program: baseProgram({
        id: 'section-8',
        name: 'Section 8 Housing Vouchers',
        description: 'Housing choice vouchers helping low-income families afford private rentals.',
        source: 'USASpending.gov — CFDA 14.871 Section 8 Housing Choice Vouchers',
        geography: 'Attributed to county of the recipient housing authority.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=14.871',
      }),
    },
    {
      cfda: ['14.239'],
      program: baseProgram({
        id: 'home-investment',
        name: 'HOME Investment Partnerships',
        description: 'Federal grants for affordable housing construction and rehabilitation.',
        source: 'USASpending.gov — CFDA 14.239 HOME Investment Partnerships Program',
        geography: 'Attributed to county of the recipient jurisdiction.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=14.239',
      }),
    },
    {
      cfda: ['14.231'],
      program: baseProgram({
        id: 'homeless-assistance',
        name: 'Homeless Assistance',
        description: 'Grants supporting shelters, transitional housing, and homeless services.',
        source: 'USASpending.gov — CFDA 14.231 Emergency Solutions Grants',
        geography: 'Attributed to county of the recipient organization.',
        limitation:
          'CoC service areas may cross county lines. Funding may serve residents of neighboring counties.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=14.231',
      }),
    },
    {
      cfda: ['10.415'],
      program: baseProgram({
        id: 'rural-housing',
        name: 'Rural Housing',
        description: 'USDA loans and grants for housing in rural areas.',
        source: 'USASpending.gov — CFDA 10.415 Rural Rental Housing Loans',
        geography: 'Attributed to county of place of performance.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=10.415',
      }),
    },
  ])
  return withDataNote(result, housingDataNote(result.total))
}
