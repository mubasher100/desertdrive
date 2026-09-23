"use client"

import { useEffect, useRef, useState } from "react"
import type { Map as LeafletMap, Marker } from "leaflet"
import { AREAS } from "@lib/data/areas"
import { coordsOf, inQatar, type Destination } from "@lib/booking/destination"
import { useTranslations } from "@lib/i18n/use-translations"

/** Doha, roughly the Corniche. Where the map sits before anything is chosen. */
const DOHA: [number, number] = [25.2854, 51.531]

/**
 * The map under the destination field, always visible.
 *
 * It works both ways. Search for an area and the pin moves there, so the
 * customer can see what they picked rather than trusting a line of text; tap
 * or drag the pin and that becomes the destination, which is the only way to
 * express a villa on an unnamed street.
 *
 * OpenStreetMap tiles through Leaflet: no API key, nothing billed per view.
 *
 * It loads after first paint rather than with the page. The map is not what a
 * visitor came for and it must not delay the hero or the fields above it —
 * the container reserves its height from the start, so nothing moves when the
 * tiles arrive.
 */
export default function MapPicker({
  value,
  onChange,
}: {
  value: Destination | null
  onChange: (destination: Destination) => void
}) {
  const t = useTranslations()
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const placeRef = useRef<((lat: number, lng: number, recentre?: boolean) => void) | null>(null)
  /**
   * Set while the map itself is the one changing the destination. Without it
   * the value coming back down would re-centre the map mid-drag, which fights
   * the finger holding the pin.
   */
  const fromMapRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [outside, setOutside] = useState(false)

  useEffect(() => {
    let cancelled = false
    let idle: number | undefined

    const boot = async () => {
      try {
        const L = (await import("leaflet")).default
        await import("leaflet/dist/leaflet.css")
        if (cancelled || !hostRef.current || mapRef.current) return

        const map = L.map(hostRef.current, {
          center: DOHA,
          zoom: 11,
          // A map inside a form should not eat the page scroll on a phone.
          scrollWheelZoom: false,
        })
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map)

        /**
         * An inline SVG pin, not Leaflet's default: the stock marker points at
         * image files resolved against its stylesheet, which a bundler does
         * not serve, and renders as a broken image.
         */
        const pin = L.divIcon({
          className: "",
          html:
            '<svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            '<path d="M14 37s12-13.4 12-23A12 12 0 1 0 2 14c0 9.6 12 23 12 23z" fill="#0a4fb3" stroke="#fff" stroke-width="2"/>' +
            '<circle cx="14" cy="14" r="4.5" fill="#fff"/></svg>',
          iconSize: [28, 38],
          // Anchored at the point, so it marks exactly where it is dropped.
          iconAnchor: [14, 38],
        })

        const place = (lat: number, lng: number, recentre = false) => {
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng])
          } else {
            markerRef.current = L.marker([lat, lng], { draggable: true, icon: pin, keyboard: false })
              .addTo(map)
              .on("dragend", (e) => {
                const p = (e.target as Marker).getLatLng()
                commit(p.lat, p.lng)
              })
          }
          if (recentre) {
            map.setView([lat, lng], Math.max(map.getZoom(), 14))
          }
        }

        const commit = (lat: number, lng: number) => {
          const point = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) }
          if (!inQatar(point.lat, point.lng)) {
            setOutside(true)
            return
          }
          setOutside(false)
          place(point.lat, point.lng)
          fromMapRef.current = true
          onChange({
            kind: "place",
            // Not a Google id: the prefix says where it came from, and the
            // coordinates are the whole of it.
            place_id: `pin:${point.lat},${point.lng}`,
            address: describePin(point),
            lat: point.lat,
            lng: point.lng,
          })
        }

        map.on("click", (e) => commit(e.latlng.lat, e.latlng.lng))

        placeRef.current = place
        mapRef.current = map
        setReady(true)

        // Leaflet measures its container on creation; in a card that has just
        // been laid out it can read zero and render a single grey tile.
        setTimeout(() => map.invalidateSize(), 60)
      } catch {
        // Blocked, offline, or tiles refused. The search box above is
        // untouched, so the funnel carries on without this.
        if (!cancelled) setFailed(true)
      }
    }

    // After first paint. requestIdleCallback where it exists, a timeout
    // everywhere else (Safari), so the hero and the fields render first.
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback
    if (ric) {
      idle = ric(() => void boot(), { timeout: 2000 })
    } else {
      idle = window.setTimeout(() => void boot(), 600)
    }

    return () => {
      cancelled = true
      if (idle !== undefined) window.clearTimeout(idle)
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
      placeRef.current = null
    }
    // Mounted once. `onChange` is read through the closure deliberately: the
    // widget passes a new function identity on every render, and re-creating
    // the map for that would throw away the customer's pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Follow the search box. Choosing an area, a drawn zone or an address moves
   * the pin there and zooms in, so "The Pearl" is something the customer can
   * see rather than a word they have to trust.
   */
  useEffect(() => {
    if (!ready || !value || !placeRef.current) return
    if (fromMapRef.current) {
      // This change came from the map; the pin is already where it belongs.
      fromMapRef.current = false
      return
    }
    const { lat, lng } = coordsOf(value)
    setOutside(false)
    placeRef.current(lat, lng, true)
  }, [value, ready])

  return (
    <div className="mt-2">
      <div className="relative overflow-hidden rounded-dd border border-dd-line-strong">
        {/* Height reserved up front: the tiles arrive late and nothing shifts. */}
        <div ref={hostRef} className="h-[220px] w-full small:h-[260px]" style={{ zIndex: 0 }} />
        {!ready && !failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-dd-paper text-sm text-dd-muted">
            {t("map.loading")}
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-dd-paper px-6 text-center text-sm text-dd-muted">
            {t("map.unavailable")}
          </div>
        )}
      </div>

      <p className="mt-1.5 text-xs text-dd-muted">{value ? t("map.dragHelp") : t("map.tapHelp")}</p>

      {outside && (
        <p role="alert" className="mt-1 text-sm text-dd-danger">
          {t("map.outsideQatar")}
        </p>
      )}
    </div>
  )
}

/**
 * A human label for a pin, in English because the driver reads it.
 *
 * No reverse geocoder on purpose: that is another paid API for something the
 * nearest known area answers well enough. "Pinned location near West Bay"
 * plus exact coordinates tells the driver more than a street name they would
 * have to search for anyway.
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
