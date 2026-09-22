"use client"

/**
 * Google Places autocomplete, loaded lazily and treated as optional.
 *
 * Two rules from CLAUDE.md shape all of this:
 *
 * 1. **The funnel must survive Google failing.** A blocked, throttled or
 *    slow Maps script must not take down the only revenue path on the site,
 *    so every function here fails to `null`/`[]` and the curated area list
 *    keeps working underneath. Nothing awaits Google on the critical path.
 *
 * 2. **Session tokens are a billing mechanism, not an optimisation.** One
 *    token spans a whole type-then-select cycle and is discarded after the
 *    Place Details call that ends it. Reusing a token across two details
 *    calls, or ending a session with an IDs-only call, silently reverts every
 *    keystroke in that session to per-request billing.
 *
 * Address entry only — this never calculates a fare. It returns coordinates;
 * the server resolves distance, band and price from them.
 */

const MAPS_SCRIPT_ID = "google-maps-places"

export type PlaceSuggestion = {
  /** Google's place id, passed to fetchPlace when the customer picks it. */
  id: string
  /** The bold part: "Katara Towers". */
  main: string
  /** The rest: "Lusail, Qatar". */
  secondary: string
}

export type ResolvedPlace = {
  place_id: string
  address: string
  lat: number
  lng: number
}

export function placesKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined
}

export function placesEnabled(): boolean {
  return !!placesKey()
}

type MapsGlobal = {
  maps?: {
    importLibrary?: (name: string) => Promise<unknown>
    places?: {
      AutocompleteSessionToken: new () => unknown
      AutocompleteSuggestion: {
        fetchAutocompleteSuggestions: (req: unknown) => Promise<{ suggestions: unknown[] }>
      }
      Place: new (opts: { id: string }) => {
        fetchFields: (opts: { fields: string[] }) => Promise<unknown>
        id: string
        formattedAddress?: string | null
        location?: { lat: () => number; lng: () => number } | null
      }
    }
  }
}

function google(): MapsGlobal | undefined {
  return (globalThis as unknown as { google?: MapsGlobal }).google
}

let loading: Promise<boolean> | null = null

/**
 * Loads the Maps JS API once, and answers false rather than throwing if it
 * cannot. Callers treat false as "use the curated list", which is the same
 * path a visitor with no key, an ad blocker or hotel wifi takes.
 */
export function loadPlaces(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false)
  const key = placesKey()
  if (!key) return Promise.resolve(false)
  if (google()?.maps?.places) return Promise.resolve(true)
  if (loading) return loading

  loading = new Promise<boolean>((resolve) => {
    const existing = document.getElementById(MAPS_SCRIPT_ID) as HTMLScriptElement | null
    const script = existing ?? document.createElement("script")

    const done = async () => {
      try {
        // v=weekly + importLibrary is the supported path for Places (New).
        await google()?.maps?.importLibrary?.("places")
        resolve(!!google()?.maps?.places)
      } catch {
        resolve(false)
      }
    }

    script.addEventListener("load", done, { once: true })
    script.addEventListener("error", () => resolve(false), { once: true })

    if (!existing) {
      script.id = MAPS_SCRIPT_ID
      script.async = true
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&libraries=places&loading=async`
      document.head.appendChild(script)
    }

    // Never hang the field on a slow network: after this, the curated list is
    // simply what the customer gets.
    window.setTimeout(() => resolve(!!google()?.maps?.places), 6000)
  })

  return loading
}

/**
 * A session is one type-then-select cycle. Created on the first keystroke,
 * spent by the Place Details call, then thrown away — never reused.
 */
export function newSession(): unknown {
  try {
    const Token = google()?.maps?.places?.AutocompleteSessionToken
    return Token ? new Token() : undefined
  } catch {
    return undefined
  }
}

/** Suggestions for what has been typed so far, restricted to Qatar. */
export async function suggest(input: string, session: unknown): Promise<PlaceSuggestion[]> {
  const places = google()?.maps?.places
  if (!places || !input.trim()) return []

  try {
    const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input,
      sessionToken: session,
      includedRegionCodes: ["qa"],
      // The driver reads the address aloud, so ask Google for it in English
      // even when the customer is booking in Arabic.
      language: "en",
      region: "qa",
    })

    return (suggestions ?? [])
      .map((raw) => {
        const p = (raw as { placePrediction?: Record<string, unknown> }).placePrediction
        if (!p) return null
        const text = (v: unknown) => String((v as { text?: string } | undefined)?.text ?? "")
        const id = String(p.placeId ?? "")
        if (!id) return null
        return {
          id,
          main: text(p.mainText) || text(p.text),
          secondary: text(p.secondaryText),
        }
      })
      .filter((s): s is PlaceSuggestion => s !== null)
      .slice(0, 6)
  } catch {
    return []
  }
}

/**
 * Turns the chosen suggestion into coordinates, ending the billing session.
 *
 * `location` and `formattedAddress` are requested together on purpose: asking
 * for ids only would be free, and would therefore un-bundle every autocomplete
 * request in the session back to per-request pricing.
 */
export async function resolvePlace(placeId: string): Promise<ResolvedPlace | null> {
  const places = google()?.maps?.places
  if (!places) return null

  try {
    const place = new places.Place({ id: placeId })
    await place.fetchFields({ fields: ["id", "location", "formattedAddress"] })
    const lat = place.location?.lat?.()
    const lng = place.location?.lng?.()
    if (typeof lat !== "number" || typeof lng !== "number") return null
    return {
      place_id: place.id || placeId,
      address: place.formattedAddress || "",
      lat,
      lng,
    }
  } catch {
    return null
  }
}
