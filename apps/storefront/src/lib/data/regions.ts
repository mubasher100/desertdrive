"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { countryOf } from "@lib/util/locale"
import { getPublicCacheOptions } from "./cookies"

export const listRegions = async () => {
  const next = {
    ...getPublicCacheOptions("regions"),
  }

  return sdk.client
    .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ regions }) => regions)
    .catch(medusaError)
}

export const retrieveRegion = async (id: string) => {
  const next = {
    ...getPublicCacheOptions(["regions", id].join("-")),
  }

  return sdk.client
    .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ region }) => region)
    .catch(medusaError)
}

const regionMap = new Map<string, HttpTypes.StoreRegion>()

/**
 * Resolves the region for a locale segment.
 *
 * Callers pass whatever is in the URL — `"en-qa"`, `"ar-qa"` or a bare `"qa"` —
 * and this normalises it to the country code the Store API understands. Doing it
 * here rather than at each call site means there is exactly ONE place where a
 * locale segment can leak into an API call, and it is this one.
 *
 * Passing `"en-qa"` straight through would find no region and return null, and
 * the page would then render with no prices rather than failing visibly.
 */
export const getRegion = async (segmentOrCountry: string) => {
  try {
    const countryCode = countryOf(segmentOrCountry)

    if (regionMap.has(countryCode)) {
      return regionMap.get(countryCode)
    }

    const regions = await listRegions()

    if (!regions) {
      return null
    }

    regions.forEach((region) => {
      region.countries?.forEach((c) => {
        regionMap.set(c?.iso_2 ?? "", region)
      })
    })

    return regionMap.get(countryCode) ?? null
  } catch (e: any) {
    return null
  }
}
