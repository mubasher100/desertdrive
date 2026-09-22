import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { FARE_ZONE_MODULE } from "../../../modules/fare-zone"

type Point = { lat: number; lng: number }

export type ZoneInput = {
  code: string
  name_en: string
  name_ar: string
  polygon: Point[]
  rank?: number
  active?: boolean
}

type Zone = ZoneInput & { id: string; rank: number; active: boolean }

type Service = {
  listFareZones: (filters: object) => Promise<Zone[]>
  createFareZones: (data: object[]) => Promise<Zone[] | Zone>
  updateFareZones: (data: object) => Promise<Zone[] | Zone>
  deleteFareZones: (ids: string[]) => Promise<void>
}

const one = (r: Zone[] | Zone): Zone => (Array.isArray(r) ? r[0] : r)

/**
 * Creates a zone.
 *
 * `code` is the join to the product catalogue — it must equal the `Distance
 * band` option value the owner prices against — so a duplicate is rejected
 * here rather than quietly shadowing an existing zone at quote time.
 */
export const createFareZoneStep = createStep(
  "create-fare-zone",
  async (input: ZoneInput, { container }) => {
    const service = container.resolve(FARE_ZONE_MODULE) as Service

    const [existing] = await service.listFareZones({ code: input.code })
    if (existing) {
      throw new MedusaError(MedusaError.Types.DUPLICATE_ERROR, `A zone with the code "${input.code}" already exists.`)
    }

    const zone = one(
      await service.createFareZones([
        {
          code: input.code,
          name_en: input.name_en,
          name_ar: input.name_ar,
          polygon: input.polygon,
          // Default rank leaves room to slot more specific zones in front.
          rank: input.rank ?? 100,
          active: input.active ?? true,
        },
      ])
    )

    return new StepResponse<Zone, string>(zone, zone.id)
  },
  async (id, { container }) => {
    if (!id) return
    await (container.resolve(FARE_ZONE_MODULE) as Service).deleteFareZones([id])
  }
)

export type UpdateZoneInput = Partial<ZoneInput> & { id: string }

/** Updates a zone, keeping the previous values for compensation. */
export const updateFareZoneStep = createStep(
  "update-fare-zone",
  async (input: UpdateZoneInput, { container }) => {
    const service = container.resolve(FARE_ZONE_MODULE) as Service

    const [before] = await service.listFareZones({ id: input.id })
    if (!before) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `No zone with id ${input.id}.`)
    }

    if (input.code && input.code !== before.code) {
      const [clash] = await service.listFareZones({ code: input.code })
      if (clash) {
        throw new MedusaError(MedusaError.Types.DUPLICATE_ERROR, `A zone with the code "${input.code}" already exists.`)
      }
    }

    const zone = one(await service.updateFareZones({ ...input }))

    return new StepResponse<Zone, Zone>(zone, before)
  },
  async (before, { container }) => {
    if (!before) return
    await (container.resolve(FARE_ZONE_MODULE) as Service).updateFareZones({
      id: before.id,
      code: before.code,
      name_en: before.name_en,
      name_ar: before.name_ar,
      polygon: before.polygon,
      rank: before.rank,
      active: before.active,
    })
  }
)

/** Deletes a zone, restoring it if a later step fails. */
export const deleteFareZoneStep = createStep(
  "delete-fare-zone",
  async (input: { id: string }, { container }) => {
    const service = container.resolve(FARE_ZONE_MODULE) as Service

    const [before] = await service.listFareZones({ id: input.id })
    if (!before) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `No zone with id ${input.id}.`)
    }

    await service.deleteFareZones([input.id])

    return new StepResponse<{ id: string }, Zone>({ id: input.id }, before)
  },
  async (before, { container }) => {
    if (!before) return
    await (container.resolve(FARE_ZONE_MODULE) as Service).createFareZones([
      {
        code: before.code,
        name_en: before.name_en,
        name_ar: before.name_ar,
        polygon: before.polygon,
        rank: before.rank,
        active: before.active,
      },
    ])
  }
)
