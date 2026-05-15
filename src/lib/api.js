const USASPENDING_AWARDS = 'https://api.usaspending.gov/api/v2/search/spending_by_award/'
const USASPENDING_GEOGRAPHY = 'https://api.usaspending.gov/api/v2/search/spending_by_geography/'

const VINTAGE = 'Awards from FY2015 through FY2025.'

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
      source: 'Estimated from national SNAP participation rates (USDA FNS)',
      geography: 'County-level estimate based on population and national participation rates.',
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
      source: 'Estimated from national WIC participation rates (USDA FNS)',
      geography: 'County-level estimate based on population and national participation rates.',
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
    vintage: VINTAGE,
    limitation,
    population: null,
    sourceUrl,
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

function hasZeroAmountProgram(programs) {
  return programs.some((p) => p.amount === 0)
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

function educationDataNote(total, programs) {
  if (total === 0) return DATA_NOTES.education.zero
  if (hasZeroAmountProgram(programs)) return DATA_NOTES.education.partial
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
        source: 'USASpending.gov — CFDA 97.039 Hazard Mitigation Grant Program',
        geography: 'Funding attributed to county of project location.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=97.039',
      }),
    },
    {
      cfda: ['97.036'],
      program: baseProgram({
        id: 'fema-public-assistance',
        name: 'FEMA Public Assistance',
        description:
          'Reimbursement to local governments for disaster response, debris removal, and infrastructure repair.',
        source: 'USASpending.gov — CFDA 97.036 FEMA Public Assistance',
        geography: 'Attributed to county of the applicant organization.',
        limitation:
          'Covers declared disasters only. Routine emergency management funding tracked separately.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=97.036',
      }),
    },
    {
      cfda: ['16.738'],
      program: baseProgram({
        id: 'byrne-jag',
        name: 'Byrne JAG Grants',
        description:
          'Federal grants supporting local law enforcement, crime prevention, and criminal justice programs.',
        source: 'USASpending.gov — CFDA 16.738 Justice Assistance Grants',
        geography: 'Attributed to county of place of performance.',
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
        source: 'USASpending.gov — CFDA 97.044 Assistance to Firefighters',
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
        source: 'USASpending.gov — CFDA 64.024/64.025 Veterans Programs',
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
  const result = await fetchCategory(countyFips, stateCode, [
    {
      cfda: ['84.010'],
      program: baseProgram({
        id: 'title-i',
        name: 'Title I',
        description: 'Funding for schools serving high concentrations of low-income students.',
        source: 'USASpending.gov — CFDA 84.010 Title I Grants to Local Educational Agencies',
        geography: 'Attributed to county of the recipient school district.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=84.010',
      }),
    },
    {
      cfda: ['84.027'],
      program: baseProgram({
        id: 'idea',
        name: 'Special Education (IDEA)',
        description: 'Grants supporting education for students with disabilities.',
        source: 'USASpending.gov — CFDA 84.027 Special Education Grants to States',
        geography: 'Attributed to county of the recipient school district.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=84.027',
      }),
    },
    {
      cfda: ['10.555'],
      program: baseProgram({
        id: 'school-lunch',
        name: 'School Lunch Program',
        description: 'Federal reimbursements to schools for free and reduced-price meals.',
        source: 'USASpending.gov — CFDA 10.555 National School Lunch Program',
        geography: 'Attributed to county of the recipient school or district.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=10.555',
      }),
    },
    {
      cfda: ['93.600'],
      program: baseProgram({
        id: 'head-start',
        name: 'Head Start',
        description: 'Early childhood education, health, and nutrition for low-income children.',
        source: 'USASpending.gov — CFDA 93.600 Head Start',
        geography: 'Attributed to county of the recipient organization.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=93.600',
      }),
    },
    {
      cfda: ['84.063'],
      program: baseProgram({
        id: 'pell-grants',
        name: 'Pell Grants',
        description: 'Need-based grants for undergraduate students at colleges in this county.',
        source: 'USASpending.gov — CFDA 84.063 Federal Pell Grant Program',
        geography: 'Attributed to county of the recipient institution, not student residence.',
        limitation:
          'Reflects grants to institutions located in this county. Students may commute from other counties.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=84.063',
      }),
    },
    {
      cfda: ['93.767'],
      program: baseProgram({
        id: 'chip',
        name: 'CHIP',
        description: 'Health insurance coverage for children in low-income families.',
        source: "USASpending.gov — CFDA 93.767 Children's Health Insurance Program",
        geography: 'Attributed to county of the administering state agency office.',
        limitation: 'State-administered program. County attribution is approximate.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=93.767',
      }),
    },
  ])
  return withDataNote(result, educationDataNote(result.total, result.programs))
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
        geography: 'Attributed to county of the administering state Medicaid agency.',
        limitation: 'State-administered program. County attribution is approximate.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=93.778',
      }),
    },
    {
      cfda: ['93.912'],
      program: baseProgram({
        id: 'rural-health',
        name: 'Rural Health Grants',
        description: 'Grants supporting healthcare access and workforce in rural communities.',
        source: 'USASpending.gov — CFDA 93.912 Rural Health Care Services Outreach',
        geography: 'Attributed to county of the recipient healthcare organization.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=93.912',
      }),
    },
    {
      cfda: ['93.224'],
      program: baseProgram({
        id: 'community-health-centers',
        name: 'Community Health Centers',
        description: 'Funding for community health centers serving underserved populations.',
        source: 'USASpending.gov — CFDA 93.224 Community Health Centers',
        geography: 'Attributed to county of the health center location.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=93.224',
      }),
    },
    {
      cfda: ['64.009'],
      program: baseProgram({
        id: 'va-healthcare',
        name: 'VA Healthcare',
        description: 'Veterans healthcare services and facility operations in this county.',
        source: 'USASpending.gov — CFDA 64.009 Veterans Medical Care Benefits',
        geography: 'Attributed to county of the VA facility or service area.',
        limitation: 'Includes facility-based care. Not all veteran residents are served locally.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=64.009',
      }),
    },
    {
      cfda: ['93.958'],
      program: baseProgram({
        id: 'mental-health',
        name: 'Mental Health Services',
        description: 'Grants for community mental health services and treatment programs.',
        source: 'USASpending.gov — CFDA 93.958 Block Grants for Community Mental Health',
        geography: 'Attributed to county of the recipient service provider.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=93.958',
      }),
    },
    {
      cfda: ['93.959'],
      program: baseProgram({
        id: 'substance-abuse',
        name: 'Substance Abuse Treatment',
        description: 'Grants for substance abuse prevention and treatment services.',
        source: 'USASpending.gov — CFDA 93.959 Block Grants for Substance Abuse Prevention',
        geography: 'Attributed to county of the recipient treatment provider.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=93.959',
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
        source: 'USASpending.gov — CFDA 20.507 Federal Transit Formula Grants',
        geography: 'Attributed to county of the recipient transit authority.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=20.507',
      }),
    },
    {
      cfda: ['10.888'],
      program: baseProgram({
        id: 'broadband',
        name: 'Broadband Infrastructure',
        description: 'Grants to expand high-speed internet access in underserved areas.',
        source: 'USASpending.gov — CFDA 10.888 Broadband ReConnect Program',
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
        geography: 'Attributed to county of the recipient utility or municipality.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=66.458',
      }),
    },
    {
      cfda: ['66.460'],
      program: baseProgram({
        id: 'epa-clean-water',
        name: 'EPA Clean Water Grants',
        description: 'EPA grants to protect and restore local waterways and ecosystems.',
        source: 'USASpending.gov — CFDA 66.460 Nonpoint Source Implementation Grants',
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
        geography: 'Attributed to county of the remediation site.',
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
    geography: 'Attributed to county of the recipient farm operation.',
    sourceUrl: 'https://sam.gov/search?index=cfda&q=10.406',
  })

  const agExtensionProgram = baseProgram({
    id: 'ag-extension',
    name: 'Agricultural Extension',
    description: 'USDA funding for university extension programs supporting local farmers.',
    source: 'USASpending.gov — CFDA 10.500 Cooperative Extension Service',
    geography: 'Attributed to county of the recipient university or extension office.',
    sourceUrl: 'https://sam.gov/search?index=cfda&q=10.500',
  })

  const cropInsuranceProgram = baseProgram({
    id: 'crop-insurance',
    name: 'Crop Insurance',
    description: 'Federal support for crop insurance protecting farmers from weather losses.',
    source:
      'USASpending.gov — CFDA 10.450 Crop Insurance and 10.195 Consolidated Farm and Rural Development',
    geography: 'Attributed to county of the insured farm operation.',
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
        geography: 'Attributed to county of the recipient municipality or county government.',
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
        geography: 'Attributed to county of the Continuum of Care lead agency.',
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
        geography: 'Attributed to county of the housing project location.',
        sourceUrl: 'https://sam.gov/search?index=cfda&q=10.415',
      }),
    },
  ])
  return withDataNote(result, housingDataNote(result.total))
}
