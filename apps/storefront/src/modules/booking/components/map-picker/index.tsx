"use client"

import { useEffect, useRef, useState } from "react"
import { clx } from "@medusajs/ui"
import type { Map as LeafletMap, Marker } from "leaflet"
import { AREAS } from "@lib/data/areas"
import { inQatar, type Destination } from "@lib/booking/destination"
import { useTranslations } from "@lib/i18n/use-translations"

/** Doha, roughly the Corniche. Where the map opens when there is nothing to centre on. */
const DOHA: [number, number] = [25.2854, 51.531]

/**
 * Drop a pin on where you actually are.
 *
 * A villa on an unnamed street is the case no search box handles: the guest
 * knows the building when they see it and cannot name it. So the map is not a
 * nicety here, it is the fallback for the destinations the list and the
 * autocomplete both miss.
 *
 * OpenStreetMap tiles through Leaflet, loaded only when the map is opened:
 * no API key, nothing billed per view, and the booking form stays light for
 * the majority who never open it. The pin's coordinates are what price the
 * trip — server-side, same as every other destination — and they ride onto
 * the booking so the driver can navigate to the exact spot rather than to a
 * district.
 */
export default function MapPicker({
  open,
  initial,
  onCancel,
  onConfirm,
}: {
  open: boolean
  initial: Destination | null
  onCancel: () => void
  onConfirm: (destination: Destination) => void
}) {
  const t = useTranslations()
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    // Dynamic import: Leaflet and its stylesheet are ~45 KB that most visitors
    // never need, and loading them up front would slow the page that converts.
    ;(async () => {
      try {
        const L = (await import("leaflet")).default
        await import("leaflet/dist/leaflet.css")
        if (cancelled || !hostRef.current || mapRef.current) return

        const start =
          initial && initial.kind === "place"
            ? ([initial.lat, initial.lng] as [number, number])
            : initial && initial.kind === "area"
              ? ([initial.area.lat, initial.area.lng] as [number, number])
              : DOHA

        const map = L.map(hostRef.current, { center: start, zoom: initial ? 15 : 11 })
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map)

        /**
         * An inline SVG pin, not Leaflet's default.
         *
         * The stock marker points at image files resolved relative to the
         * stylesheet, which a bundler does not serve — it renders as a broken
         * image. A divIcon has no assets to lose, and it can be the brand
         * colour rather than Leaflet's blue.
         */
        const pin = L.divIcon({
          className: "",
          html:
            '<svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            '<path d="M14 37s12-13.4 12-23A12 12 0 1 0 2 14c0 9.6 12 23 12 23z" fill="#0a4fb3" stroke="#fff" stroke-width="2"/>' +
            '<circle cx="14" cy="14" r="4.5" fill="#fff"/></svg>',
          iconSize: [28, 38],
          // Anchored at the point of the pin, so it marks where it is dropped.
          iconAnchor: [14, 38],
        })

        const place = (lat: number, lng: number) => {
          setPoint({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) })
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng])
          } else {
            markerRef.current = L.marker([lat, lng], { draggable: true, icon: pin, keyboard: false })
              .addTo(map)
              .on("dragend", (e) => {
                const p = (e.target as Marker).getLatLng()
                setPoint({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) })
              })
          }
        }

        if (initial) place(start[0], start[1])
        map.on("click", (e) => place(e.latlng.lat, e.latlng.lng))

        mapRef.current = map
        setReady(true)

        // Leaflet measures the container on creation; inside a panel that was
        // hidden a moment ago it reads zero and renders one grey tile.
        setTimeout(() => map.invalidateSize(), 60)
      } catch {
        // Blocked, offline, or tiles refused: say so and leave the search box.
        if (!cancelled) setFailed(true)
      }
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
      setReady(false)
    }
  }, [open, initial])

  if (!open) return null

  const valid = point && inQatar(point.lat, point.lng)

  return (
    <div className="mt-2 rounded-dd border border-dd-line-strong bg-dd-surface p-3">
      {failed ? (
        <p className="py-6 text-center text-sm text-dd-muted">{t("map.unavailable")}</p>
      ) : (
        <>
          <div ref={hostRef} className="h-[260px] w-full overflow-hidden rounded-dd-sm" style={{ zIndex: 0 }} />
          <p className="mt-2 text-xs text-dd-muted">{point ? t("map.dragHelp") : t("map.tapHelp")}</p>
          {point && !valid && (
            <p role="alert" className="mt-2 text-sm text-dd-danger">
              {t("map.outsideQatar")}
            </p>
          )}
        </>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-touch flex-1 rounded-dd border border-dd-line-strong bg-dd-surface px-4 text-sm font-semibold text-dd-ink"
        >
          {t("map.cancel")}
        </button>
        <button
          type="button"
          disabled={!valid || !ready}
          onClick={() => {
            if (!point || !valid) return
            onConfirm({
              kind: "place",
              // Not a Google id: the prefix says where this came from, and the
              // coordinates are the whole of it.
              place_id: `pin:${point.lat},${point.lng}`,
              address: describePin(point),
              lat: point.lat,
              lng: point.lng,
            })
          }}
          className={clx(
            "min-h-touch flex-1 rounded-dd px-4 text-sm font-semibold text-dd-on-accent",
            valid && ready ? "bg-dd-accent hover:bg-dd-accent-strong" : "bg-dd-accent opacity-50"
          )}
        >
          {t("map.confirm")}
        </button>
      </div>
    </div>
  )
}

/**
 * A human label for a pin, in English because the driver reads it.
 *
 * There is no reverse geocoder here on purpose — that is another paid API for
 * something the nearest known area answers well enough. "Pinned location near
 * West Bay" plus exact coordinates tells the driver more than a street name
 * they would have to search for anyway.
 */
function describePin(point: { lat: number; lng: number }): string {
  let nearest = AREAS[0]
  let best = Number.POSITIVE_INFINITY

  for (const area of AREAS) {
    // Squared degrees: only the ordering matters, so the square root and the
    // earth's curvature are both wasted work at this scale.
    const d = (area.lat - point.lat) ** 2 + (area.lng - point.lng) ** 2
    if (d < best) {
      best = d
      nearest = area
    }
  }

  return `Pinned location near ${nearest.name_en}`
}
