const CENSUS_GEOGRAPHIES_URL =
  'https://geocoding.geo.census.gov/geocoder/geographies/address'
const FCC_CENSUS_BLOCK_URL = 'https://geo.fcc.gov/api/census/block/find'
const ZIPPOPOTAM_URL = 'https://api.zippopotam.us/us'
const NCES_URL =
  'https://nces.ed.gov/opengis/rest/services/K12_School_Locations/EDGE_GEOCODE_PUBLICLEA_1819/MapServer/0/query'

const FIPS_TO_STATE = {
  '01': 'al',
  '02': 'ak',
  '04': 'az',
  '05': 'ar',
  '06': 'ca',
  '08': 'co',
  '09': 'ct',
  '10': 'de',
  '11': 'dc',
  '12': 'fl',
  '13': 'ga',
  '15': 'hi',
  '16': 'id',
  '17': 'il',
  '18': 'in',
  '19': 'ia',
  '20': 'ks',
  '21': 'ky',
  '22': 'la',
  '23': 'me',
  '24': 'md',
  '25': 'ma',
  '26': 'mi',
  '27': 'mn',
  '28': 'ms',
  '29': 'mo',
  '30': 'mt',
  '31': 'ne',
  '32': 'nv',
  '33': 'nh',
  '34': 'nj',
  '35': 'nm',
  '36': 'ny',
  '37': 'nc',
  '38': 'nd',
  '39': 'oh',
  '40': 'ok',
  '41': 'or',
  '42': 'pa',
  '44': 'ri',
  '45': 'sc',
  '46': 'sd',
  '47': 'tn',
  '48': 'tx',
  '49': 'ut',
  '50': 'vt',
  '51': 'va',
  '53': 'wa',
  '54': 'wv',
  '55': 'wi',
  '56': 'wy',
  '72': 'pr',
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/['.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function stateFromFips(stateFips) {
  return FIPS_TO_STATE[stateFips] ?? null
}

function geographyName(geo) {
  return geo?.FULLNAME ?? geo?.NAME ?? null
}

function buildCounty(name, fips) {
  return {
    name,
    slug: slugify(name),
    fips: fips ?? null,
  }
}

function parseCensusZipMatch(match) {
  const counties = match?.geographies?.Counties
  if (!counties?.length) {
    return null
  }

  return {
    county: counties[0],
    place: match.geographies['Incorporated Places']?.[0] ?? null,
  }
}

async function attemptCensusByZip(zip) {
  const params = new URLSearchParams({
    benchmark: 'Public_AR_Current',
    vintage: 'Current_Current',
    layers: 'Counties,Incorporated Places',
    format: 'json',
    zip,
  })

  const response = await fetch(`${CENSUS_GEOGRAPHIES_URL}?${params}`)
  if (!response.ok) {
    return { result: null, retry: response.status === 503 }
  }

  const data = await response.json()
  if (data?.errors?.length) {
    return { result: null, retry: false }
  }

  return { result: parseCensusZipMatch(data?.result?.addressMatches?.[0]), retry: false }
}

async function fetchCensusByZip(zip) {
  try {
    let { result, retry } = await attemptCensusByZip(zip)
    if (result) {
      return result
    }

    if (retry) {
      await wait(1000)
      ;({ result } = await attemptCensusByZip(zip))
    }

    return result
  } catch {
    await wait(1000)
    try {
      const { result } = await attemptCensusByZip(zip)
      return result
    } catch {
      return null
    }
  }
}

async function fetchZippopotam(zip) {
  let response
  try {
    response = await fetch(`${ZIPPOPOTAM_URL}/${zip}`)
  } catch {
    return { networkError: true }
  }

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    return { networkError: true }
  }

  let data
  try {
    data = await response.json()
  } catch {
    return { networkError: true }
  }

  const place = data?.places?.[0]
  if (!place) {
    return null
  }

  return {
    city: place['place name'],
    state: place['state abbreviation'].toLowerCase(),
    longitude: place.longitude,
    latitude: place.latitude,
  }
}

async function fetchFccCounty(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    format: 'json',
  })

  try {
    const response = await fetch(`${FCC_CENSUS_BLOCK_URL}?${params}`)
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const countyName = data?.County?.name
    if (!countyName) {
      return null
    }

    return {
      county: buildCounty(countyName, data.County.FIPS),
      state: data.State?.code?.toLowerCase() ?? null,
    }
  } catch {
    return null
  }
}

function countyProxyFromCity(cityName) {
  const name = `${cityName} Area`
  return buildCounty(name, null)
}

async function fetchSchoolDistricts(zip) {
  const params = new URLSearchParams({
    where: `ZIP='${zip}'`,
    outFields: 'LEAID,NAME,STFIP',
    f: 'json',
  })

  try {
    const response = await fetch(`${NCES_URL}?${params}`)
    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return (data?.features ?? []).map((feature) => ({
      id: feature.attributes.LEAID,
      name: feature.attributes.NAME,
    }))
  } catch {
    return []
  }
}

async function resolveGeography(zip) {
  const censusResult = await fetchCensusByZip(zip)

  if (censusResult) {
    const state = stateFromFips(censusResult.county.STATE)
    if (state) {
      const countyName = geographyName(censusResult.county)
      const placeName = geographyName(censusResult.place)

      return {
        state,
        county: buildCounty(countyName, String(censusResult.county.GEOID).slice(0, 5)),
        city: {
          name: placeName,
          slug: placeName ? slugify(placeName) : null,
        },
      }
    }
  }

  const zippopotam = await fetchZippopotam(zip)

  if (!zippopotam) {
    throw new Error('ZIP_NOT_FOUND')
  }

  if (zippopotam.networkError) {
    throw new Error('GEO_API_ERROR')
  }

  const { city, state: zippState, longitude, latitude } = zippopotam
  const fccResult = await fetchFccCounty(latitude, longitude)

  const county = fccResult?.county ?? countyProxyFromCity(city)
  const state = fccResult?.state ?? zippState

  return {
    state,
    county,
    city: {
      name: city,
      slug: slugify(city),
    },
  }
}

export async function resolveZip(zip) {
  const districtRows = await fetchSchoolDistricts(zip)

  let geography
  try {
    geography = await resolveGeography(zip)
  } catch (err) {
    if (err.message === 'ZIP_NOT_FOUND' || err.message === 'GEO_API_ERROR') {
      throw err
    }
    throw new Error('GEO_API_ERROR')
  }

  const districts = districtRows.map((row) => ({
    id: String(row.id),
    name: row.name,
    slug: slugify(row.name),
  }))

  const result = {
    zip,
    state: geography.state,
    county: geography.county,
    city: geography.city,
    districts,
  }

  console.log('resolved geoResult:', JSON.stringify(result, null, 2))
  return result
}
