"use client"

import { useEffect, useRef, useState } from "react"
import type { Map as LeafletMap, Marker } from "leaflet"
import { AREAS } from "@lib/data/areas"
import { coordsOf, inQatar, type Destination } from "@lib/booking/destination"
import { useLanguage, useTranslations } from "@lib/i18n/use-translations"

/** Doha, roughly the Corniche. Where the map sits before anything is chosen. */
const DOHA: [number, number] = [25.2854, 51.531]

/**
 * Tiles, chosen by the language the site is being read in.
 *
 * OpenStreetMap's standard tiles label places in the local language, which in
 * Qatar means Arabic — correct for /ar-qa and not ideal for a visitor reading
 * the English site, who cannot match "الدحيل" to the Duhail they just
 * searched. Their attribution is a condition of use, not decoration.
 *
 * ⚠️ CARTO used to serve the same OSM data with Latin labels and no key, and
 * this is what the English map used. **They now stamp "API KEY REQUIRED"
 * across every tile** — every style, still HTTP 200, so nothing errors and
 * nothing logs; the customer simply sees a broken-looking map (reported from a
 * phone, 23 Sept 2026). CARTO's free key is for non-commercial use only, which
 * this is not.
 *
 * The replacement is **OpenFreeMap**: the same OSM data, free for commercial
 * use, no key, no request limits, and its Liberty style labels in `name:latin`
 * — which is what makes an English map English. The catch is that it serves
 * vector tiles, so English needs MapLibre where Arabic needs nothing.
 *
 * Hence two paths, on purpose:
 *
 *   ar  → raster OSM through Leaflet. Local-language labels are CORRECT here,
 *          and it costs the phone nothing beyond the tiles.
 *   en  → OpenFreeMap vector through MapLibre, loaded only on the English
 *          site, so an Arabic visitor never pays for a renderer that would
 *          give them worse labels.
 *
 * `NEXT_PUBLIC_MAP_TILE_URL` still overrides English with a raster provider
 * and skips MapLibre entirely — lighter on a phone, and the path to take if
 * the owner ever holds a key for one. Set `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`
 * with it: every provider requires one, and the wrong attribution is worse
 * than none.
 */
const OSM = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  subdomains: "abc",
} as const

/** A raster override, when one is configured. Null means "use the default for this language". */
const RASTER_OVERRIDE =
  process.env.NEXT_PUBLIC_MAP_TILE_URL && process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
    ? {
        url: process.env.NEXT_PUBLIC_MAP_TILE_URL,
        attribution: process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION,
        subdomains: process.env.NEXT_PUBLIC_MAP_TILE_SUBDOMAINS || "abcd",
      }
    : null

/**
 * Satellite imagery, when a provider is configured.
 *
 * There is no free, key-less, high-resolution satellite layer that permits
 * commercial use — Esri's World Imagery is the one everyone reaches for and
 * its terms require a key and exclude commercial use; Google, Bing, Mapbox and
 * MapTiler all want a key too. The free open imagery that exists (Sentinel-2,
 * NASA GIBS) is 10 m per pixel or coarser, where a villa is a pixel or two,
 * which is not a view you can pick a house off.
 *
 * So this is off unless `NEXT_PUBLIC_MAP_SATELLITE_URL` is set, and the toggle
 * is not rendered at all when it is not — a dead control is worse than no
 * control. Set the attribution with it: every provider requires one.
 */
const SATELLITE =
  process.env.NEXT_PUBLIC_MAP_SATELLITE_URL && process.env.NEXT_PUBLIC_MAP_SATELLITE_ATTRIBUTION
    ? {
        url: process.env.NEXT_PUBLIC_MAP_SATELLITE_URL,
        attribution: process.env.NEXT_PUBLIC_MAP_SATELLITE_ATTRIBUTION,
        subdomains: process.env.NEXT_PUBLIC_MAP_SATELLITE_SUBDOMAINS || "abcd",
      }
    : null

const VECTOR_STYLE = "https://tiles.openfreemap.org/styles/liberty"

const VECTOR_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · ' +
  '<a href="https://openfreemap.org/">OpenFreeMap</a>'

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
  const language = useLanguage()
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
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  /** Set by the geolocation button; read inside the map closure. */
  const commitRef = useRef<((lat: number, lng: number) => void) | null>(null)
  /** Swapping to satellite needs the map and the imagery layer after boot. */
  const satelliteRef = useRef<import("leaflet").TileLayer | null>(null)
  const [satellite, setSatellite] = useState(false)

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
        /**
         * English gets vector tiles so the labels are in Latin script; Arabic
         * gets raster, because its labels are already right and a phone should
         * not download a renderer to be given worse ones.
         *
         * A failure here must not take the map down: the pin, the tap-to-pick
         * and the drag are the part that books a trip, and they work over an
         * empty background. So the vector layer is tried, and anything that
         * goes wrong falls through to the raster tiles everyone else gets.
         */
        const raster = (tiles: { url: string; attribution: string; subdomains: string }) =>
          L.tileLayer(tiles.url, {
            maxZoom: 19,
            attribution: tiles.attribution,
            subdomains: tiles.subdomains,
          }).addTo(map)

        if (SATELLITE) {
          satelliteRef.current = L.tileLayer(SATELLITE.url, {
            maxZoom: 20,
            attribution: SATELLITE.attribution,
            subdomains: SATELLITE.subdomains,
          })
        }

        if (language === "ar" || RASTER_OVERRIDE) {
          raster(RASTER_OVERRIDE && language !== "ar" ? RASTER_OVERRIDE : OSM)
        } else {
          try {
            const maplibre = (await import("maplibre-gl")).default
            await import("maplibre-gl/dist/maplibre-gl.css")
            await import("@maplibre/maplibre-gl-leaflet")
            if (cancelled) return

            const layer = L.maplibreGL({ style: VECTOR_STYLE }).addTo(map)

            // The plugin takes no attribution option, and the credit is a
            // condition of using both OSM's data and OpenFreeMap's hosting.
            map.attributionControl.addAttribution(VECTOR_ATTRIBUTION)

            /**
             * Latin only on the English map.
             *
             * Liberty's default prints both scripts — "Doha" above
             * "الدوحة" — which is right for a bilingual country and twice
             * the labels on a 375px phone. The Arabic map is a separate path
             * and keeps its own names.
             *
             * Best-effort: a style that changes shape upstream leaves the
             * labels bilingual, which is the same map with more words on it,
             * not a broken one.
             */
            const gl = layer.getMaplibreMap()
            gl.on("styledata", () => {
              try {
                for (const l of gl.getStyle().layers ?? []) {
                  if (l.type !== "symbol") continue
                  const field = gl.getLayoutProperty(l.id, "text-field")
                  if (field) gl.setLayoutProperty(l.id, "text-field", ["get", "name:latin"])
                }
              } catch {
                /* bilingual labels are an acceptable map */
              }
            })
            void maplibre
          } catch {
            raster(OSM)
          }
        }

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

        commitRef.current = commit
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
  }, [language])

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

  /**
   * "Use my current location".
   *
   * Most useful on a departure, where the customer is standing at the villa
   * they want collecting from. The browser asks permission; a refusal is an
   * ordinary answer, not an error, so it is said plainly and the map stays as
   * it was. A position outside Qatar is rejected by the same rule as a tapped
   * pin — someone booking from abroad should not have their hotel in London
   * priced as a Doha transfer.
   */
  /**
   * Swap between the street map and the imagery.
   *
   * Imagery goes ON TOP rather than replacing the base: it is the thing that
   * can fail — a provider's quota, a bad key — and when it does the customer
   * is left looking at the street map rather than at nothing. The pin sits
   * above both either way, so a trip stays bookable through any of it.
   */
  function toggleSatellite() {
    const map = mapRef.current
    const layer = satelliteRef.current
    if (!map || !layer) return

    if (satellite) {
      map.removeLayer(layer)
    } else {
      layer.addTo(map)
      layer.bringToFront()
    }
    setSatellite(!satellite)
  }

  function locate() {
    if (!navigator.geolocation) {
      setLocateError(t("map.locateUnsupported"))
      return
    }
    setLocateError(null)
    setLocating(true)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const { latitude, longitude } = pos.coords
        if (!inQatar(latitude, longitude)) {
          setLocateError(t("map.locateOutside"))
          return
        }
        commitRef.current?.(latitude, longitude)
        placeRef.current?.(latitude, longitude, true)
      },
      () => {
        setLocating(false)
        setLocateError(t("map.locateDenied"))
      },
      // A rough fix is useless for a pickup point, and a stale one is worse.
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    )
  }

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

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={locate}
          disabled={locating || !ready}
          className="inline-flex min-h-touch items-center gap-x-1.5 text-sm font-medium text-dd-accent-text underline underline-offset-4 disabled:opacity-60"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="10" cy="10" r="3.2" />
            <circle cx="10" cy="10" r="7" />
            <path d="M10 1v2M10 17v2M1 10h2M17 10h2" strokeLinecap="round" />
          </svg>
          {locating ? t("map.locating") : t("map.useMyLocation")}
        </button>
        {SATELLITE && (
          <button
            type="button"
            onClick={toggleSatellite}
            disabled={!ready}
            aria-pressed={satellite}
            className="inline-flex min-h-touch items-center gap-x-1.5 text-sm font-medium text-dd-accent-text underline underline-offset-4 disabled:opacity-60"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="10" cy="10" r="7.2" />
              <path d="M2.8 10h14.4M10 2.8c2 2.2 2 12.2 0 14.4M10 2.8c-2 2.2-2 12.2 0 14.4" />
            </svg>
            {satellite ? t("map.showMap") : t("map.showSatellite")}
          </button>
        )}
        <p className="text-xs text-dd-muted">{value ? t("map.dragHelp") : t("map.tapHelp")}</p>
      </div>

      {locateError && (
        <p role="alert" className="mt-1 text-sm text-dd-danger">
          {locateError}
        </p>
      )}

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
