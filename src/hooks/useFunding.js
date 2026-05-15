import { useQuery } from '@tanstack/react-query'
import {
  fetchCommunitySafety,
  fetchEducation,
  fetchFoodAndFarming,
  fetchHealth,
  fetchHousing,
  fetchInfrastructure,
} from '../lib/api'

const STALE_TIME = 1000 * 60 * 60 * 24

function useFundingCategory(slug, queryFn, countyFips, stateCode) {
  return useQuery({
    queryKey: ['funding', slug, countyFips],
    queryFn: () => queryFn(countyFips, stateCode),
    enabled: !!countyFips && !!stateCode,
    staleTime: STALE_TIME,
    retry: 1,
  })
}

export function useEducation(countyFips, stateCode) {
  return useFundingCategory('education', fetchEducation, countyFips, stateCode)
}

export function useHealth(countyFips, stateCode) {
  return useFundingCategory('health', fetchHealth, countyFips, stateCode)
}

export function useInfrastructure(countyFips, stateCode) {
  return useFundingCategory('infrastructure', fetchInfrastructure, countyFips, stateCode)
}

export function useFoodAndFarming(countyFips, stateCode) {
  return useFundingCategory('food-and-farming', fetchFoodAndFarming, countyFips, stateCode)
}

export function useHousing(countyFips, stateCode) {
  return useFundingCategory('housing', fetchHousing, countyFips, stateCode)
}

export function useCommunitySafety(countyFips, stateCode) {
  return useFundingCategory('community-safety', fetchCommunitySafety, countyFips, stateCode)
}
