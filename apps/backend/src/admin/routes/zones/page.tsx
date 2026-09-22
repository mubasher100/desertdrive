import { defineRouteConfig } from "@medusajs/admin-sdk"
import { MapPin } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Switch, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { sdk } from "../../lib/client"
import ZoneMap, { type Point } from "../../components/zone-map"

type Zone = {
  id: string
  code: string
  name_en: string
  name_ar: string
  polygon: Point[]
  rank: number
  active: boolean
}

const BLANK = { code: "", name_en: "", name_ar: "", rank: 100, active: true }

/**
 * Priced areas, drawn on a map.
 *
 * Distance bands price a ring around the airport; a zone prices a place. Draw
 * The Pearl once and every villa inside it quotes the same, whether the
 * customer picked Porto Arabia or Viva Bahriya — which is the whole point,
 * because those two sit in different bands.
 *
 * The map is OpenStreetMap through Leaflet: no API key, no per-view billing,
 * and nothing here calls Google.
 */
const ZonesPage = () => {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<typeof BLANK>(BLANK)
  const [points, setPoints] = useState<Point[]>([])
  const drawing = selectedId === null

  const { data, isLoading } = useQuery({
    queryKey: ["fare-zones"],
    queryFn: () => sdk.client.fetch<{ fare_zones: Zone[] }>("/admin/fare-zones"),
  })

  const zones = useMemo(() => data?.fare_zones ?? [], [data])
  const selected = zones.find((z) => z.id === selectedId) ?? null

  // Load the chosen zone into the editor; clearing it starts a new one.
  useEffect(() => {
    if (!selected) {
      setDraft(BLANK)
      setPoints([])
      return
    }
    setDraft({
      code: selected.code,
      name_en: selected.name_en,
      name_ar: selected.name_ar,
      rank: selected.rank,
      active: selected.active,
    })
    setPoints(Array.isArray(selected.polygon) ? selected.polygon : [])
  }, [selected])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["fare-zones"] })

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...draft, polygon: points, rank: Number(draft.rank) || 0 }
      if (selectedId) {
        return sdk.client.fetch(`/admin/fare-zones/${selectedId}`, { method: "POST", body })
      }
      return sdk.client.fetch("/admin/fare-zones", { method: "POST", body })
    },
    onSuccess: () => {
      toast.success(selectedId ? "Area updated" : "Area created")
      setSelectedId(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || "Could not save the area"),
  })

  const remove = useMutation({
    mutationFn: (id: string) => sdk.client.fetch(`/admin/fare-zones/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Area deleted")
      setSelectedId(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete the area"),
  })

  const canSave = draft.code.trim() && draft.name_en.trim() && draft.name_ar.trim() && points.length >= 3

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h1">Priced areas</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Draw an area, name it, and give it a code. Any destination inside it is priced by that code instead of its
          distance band — so everywhere in The Pearl costs the same, however far out it sits.
        </Text>
      </div>

      <div className="grid gap-px bg-ui-border-base md:grid-cols-[320px_1fr]">
        {/* ---- list ---- */}
        <div className="bg-ui-bg-base">
          <div className="flex items-center justify-between px-4 py-3">
            <Text size="small" weight="plus" leading="compact">
              {zones.length} area{zones.length === 1 ? "" : "s"}
            </Text>
            <Button size="small" variant="secondary" onClick={() => setSelectedId(null)} disabled={drawing}>
              New area
            </Button>
          </div>

          {isLoading ? (
            <Text size="small" className="px-4 pb-4 text-ui-fg-subtle">
              Loading…
            </Text>
          ) : zones.length === 0 ? (
            <Text size="small" className="px-4 pb-4 text-ui-fg-subtle">
              No areas yet. Everything is priced by distance band until you draw one.
            </Text>
          ) : (
            <ul className="divide-y">
              {zones.map((z) => (
                <li key={z.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(z.id)}
                    className={
                      "flex w-full flex-col items-start gap-1 px-4 py-3 text-left hover:bg-ui-bg-base-hover " +
                      (z.id === selectedId ? "bg-ui-bg-base-pressed" : "")
                    }
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <Text size="small" weight="plus" leading="compact" as="span">
                        {z.name_en}
                      </Text>
                      <Badge size="2xsmall" color={z.active ? "green" : "grey"}>
                        {z.active ? z.code : "off"}
                      </Badge>
                    </span>
                    <Text size="xsmall" className="text-ui-fg-subtle" as="span">
                      rank {z.rank} · {Array.isArray(z.polygon) ? z.polygon.length : 0} points
                    </Text>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---- editor ---- */}
        <div className="bg-ui-bg-base p-4">
          <ZoneMap
            points={points}
            onChange={setPoints}
            others={zones.filter((z) => z.id !== selectedId).map((z) => ({ id: z.id, name: z.name_en, polygon: z.polygon }))}
          />

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Labelled label="Name (English)" hint="What the customer sees, and what the driver reads.">
              <Input value={draft.name_en} onChange={(e) => setDraft({ ...draft, name_en: e.target.value })} placeholder="The Pearl" />
            </Labelled>
            <Labelled label="Name (Arabic)">
              <Input dir="rtl" value={draft.name_ar} onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })} placeholder="اللؤلؤة" />
            </Labelled>
            <Labelled
              label="Price code"
              hint="Add a variant with this exact value under Distance band on each vehicle, then set its price."
            >
              <Input
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                placeholder="the-pearl"
              />
            </Labelled>
            <Labelled label="Rank" hint="Lower wins where areas overlap. Put a compound ahead of the district around it.">
              <Input
                type="number"
                value={String(draft.rank)}
                onChange={(e) => setDraft({ ...draft, rank: Number(e.target.value) })}
              />
            </Labelled>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
            <label className="flex items-center gap-x-2">
              <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
              <Text size="small">Active</Text>
            </label>

            <div className="ms-auto flex gap-x-2">
              {selectedId && (
                <Button
                  size="small"
                  variant="danger"
                  isLoading={remove.isPending}
                  onClick={() => remove.mutate(selectedId)}
                >
                  Delete
                </Button>
              )}
              <Button size="small" variant="secondary" onClick={() => setSelectedId(null)}>
                Clear
              </Button>
              <Button size="small" isLoading={save.isPending} disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
                {selectedId ? "Save area" : "Create area"}
              </Button>
            </div>
          </div>

          {!canSave && (
            <Text size="xsmall" className="mt-2 text-ui-fg-subtle">
              Needs both names, a code, and at least three points on the map.
            </Text>
          )}

          <Text size="xsmall" className="mt-3 block text-ui-fg-subtle">
            A zone with no priced variant falls back to its distance band, so you can draw an area today and price it
            later without taking it off sale.
          </Text>
        </div>
      </div>
    </Container>
  )
}

const Labelled = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div>
    <Label size="small" weight="plus">
      {label}
    </Label>
    <div className="mt-1">{children}</div>
    {hint && (
      <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
        {hint}
      </Text>
    )}
  </div>
)

export const config = defineRouteConfig({
  label: "Priced areas",
  icon: MapPin,
})

export default ZonesPage
