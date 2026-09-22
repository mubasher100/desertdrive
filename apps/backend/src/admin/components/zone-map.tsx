import { Button, Text } from "@medusajs/ui"
import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

export type Point = { lat: number; lng: number }

type OtherZone = { id: string; name: string; polygon: unknown }

const DOHA: [number, number] = [25.2854, 51.531]

/**
 * Draw an area by clicking its corners.
 *
 * OpenStreetMap tiles through Leaflet, deliberately: no API key, no per-view
 * billing, and the admin keeps working if a Google key is ever revoked. The
 * attribution line is a condition of the tiles, not decoration — leave it.
 *
 * Vertices are draggable so an outline can be nudged rather than redrawn, and
 * the other zones are shown faintly underneath: overlaps are legal (a compound
 * inside a district), and you cannot rank them sensibly if you cannot see them.
 */
export default function ZoneMap({
  points,
  onChange,
  others = [],
}: {
  points: Point[]
  onChange: (points: Point[]) => void
  others?: OtherZone[]
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const drawnRef = useRef<L.LayerGroup | null>(null)
  const othersRef = useRef<L.LayerGroup | null>(null)
  // The click handler is rebound on every render; the latest points must be
  // readable from inside it without re-creating the map.
  const pointsRef = useRef(points)
  pointsRef.current = points

  useEffect(() => {
    if (mapRef.current || !hostRef.current) return

    const map = L.map(hostRef.current, { center: DOHA, zoom: 11, scrollWheelZoom: true })
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    othersRef.current = L.layerGroup().addTo(map)
    drawnRef.current = L.layerGroup().addTo(map)

    map.on("click", (e: L.LeafletMouseEvent) => {
      onChange([...pointsRef.current, { lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }])
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
    // Mounted once: the click handler reads the latest points through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redraw this zone whenever its points change.
  useEffect(() => {
    const group = drawnRef.current
    const map = mapRef.current
    if (!group || !map) return

    group.clearLayers()

    if (points.length >= 2) {
      const shape =
        points.length >= 3
          ? L.polygon(points as L.LatLngExpression[], { color: "#0a4fb3", weight: 2, fillOpacity: 0.15 })
          : L.polyline(points as L.LatLngExpression[], { color: "#0a4fb3", weight: 2, dashArray: "4 4" })
      shape.addTo(group)
    }

    points.forEach((p, i) => {
      const handle = L.circleMarker(p, {
        radius: 6,
        color: "#0a4fb3",
        fillColor: "#ffffff",
        fillOpacity: 1,
        weight: 2,
      })
        .addTo(group)
        // Right-click removes a corner; clicking the map only ever adds one.
        .on("contextmenu", (e: L.LeafletMouseEvent) => {
          L.DomEvent.stop(e)
          onChange(points.filter((_, j) => j !== i))
        })
      handle.bindTooltip(String(i + 1), { permanent: false, direction: "top" })
    })
  }, [points, onChange])

  // The other zones, faint, so overlaps and ranks can be judged by eye.
  useEffect(() => {
    const group = othersRef.current
    if (!group) return
    group.clearLayers()
    for (const z of others) {
      const ring = Array.isArray(z.polygon) ? (z.polygon as Point[]) : []
      if (ring.length < 3) continue
      L.polygon(ring as L.LatLngExpression[], {
        color: "#727c7e",
        weight: 1,
        fillOpacity: 0.06,
        dashArray: "3 3",
      })
        .bindTooltip(z.name)
        .addTo(group)
    }
  }, [others])

  const fit = () => {
    const map = mapRef.current
    if (!map || points.length < 2) return
    map.fitBounds(L.latLngBounds(points as L.LatLngExpression[]).pad(0.2))
  }

  return (
    <div>
      <div
        ref={hostRef}
        className="h-[380px] w-full overflow-hidden rounded-lg border border-ui-border-base"
        // Leaflet's panes stack above Medusa's toasts without this.
        style={{ zIndex: 0 }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Text size="xsmall" className="text-ui-fg-subtle">
          Click to add a corner · right-click a corner to remove it · {points.length} point
          {points.length === 1 ? "" : "s"}
        </Text>
        <div className="ms-auto flex gap-x-2">
          <Button size="small" variant="transparent" onClick={fit} disabled={points.length < 2}>
            Zoom to area
          </Button>
          <Button size="small" variant="transparent" onClick={() => onChange(points.slice(0, -1))} disabled={!points.length}>
            Undo point
          </Button>
          <Button size="small" variant="transparent" onClick={() => onChange([])} disabled={!points.length}>
            Clear points
          </Button>
        </div>
      </div>
    </div>
  )
}
