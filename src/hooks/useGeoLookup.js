import { useQuery } from '@tanstack/react-query'
import { resolveZip } from '../lib/geoResolver'

export function useGeoLookup(zip) {
  return useQuery({
    queryKey: ['geo', zip],
    queryFn: () => resolveZip(zip),
    enabled: !!zip && zip.length === 5,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  })
}
