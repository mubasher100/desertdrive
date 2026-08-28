import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  listBandVehiclesStep,
  type QuotedVehicle,
} from "./steps/list-band-vehicles"
import { resolveFareBandStep } from "./steps/resolve-fare-band"

export type ResolveQuoteInput = {
  lat: number
  lng: number
  passengers: number
  luggage: number
}

export type ResolveQuoteResult = {
  distance_km: number
  band: { code: string; name_en: string; name_ar: string }
  vehicles: QuotedVehicle[]
}

/**
 * Turns a destination into a set of priced vehicle options.
 *
 * The client supplies coordinates and a party size. Everything that touches
 * price — the distance, the band, the variant, the amount — is decided here.
 *
 * Composition rules: this body is a plain synchronous `function`, with no
 * `async`, no arrow functions and no conditionals. It runs once at application
 * load to build the graph, not per request, which is why data shaping has to go
 * through `transform` rather than ordinary statements.
 */
export const resolveQuoteWorkflow = createWorkflow(
  "resolve-quote",
  function (input: ResolveQuoteInput) {
    const resolved = resolveFareBandStep({
      lat: input.lat,
      lng: input.lng,
    })

    const vehicleQuery = transform({ resolved, input }, function (data) {
      return {
        band_code: data.resolved.band.code,
        passengers: data.input.passengers,
        luggage: data.input.luggage,
      }
    })

    const vehicles = listBandVehiclesStep(vehicleQuery)

    const result = transform({ resolved, vehicles }, function (data) {
      return {
        distance_km: data.resolved.distance_km,
        band: {
          code: data.resolved.band.code,
          name_en: data.resolved.band.name_en,
          name_ar: data.resolved.band.name_ar,
        },
        vehicles: data.vehicles,
      }
    })

    return new WorkflowResponse(result)
  }
)

export default resolveQuoteWorkflow
