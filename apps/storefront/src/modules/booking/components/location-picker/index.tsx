"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { clx } from "@medusajs/ui"
import { AREAS, areaHint, areaName, type Area } from "@lib/data/areas"
import { useLanguage, useTranslations } from "@lib/i18n/use-translations"
import { whatsappLink } from "@lib/data/contact"
import { inQatar, type Destination } from "@lib/booking/destination"
import { loadPlaces, newSession, placesEnabled, resolvePlace, suggest, type PlaceSuggestion } from "@lib/booking/places"

/**
 * Destination entry: type to search, or open the list and pick.
 *
 * It replaces a plain <select> because a visitor who knows the name of where
 * they are going should be able to type it rather than hunt a 38-item list on
 * a phone — but it keeps the select's virtue, which is that every option is
 * browsable when you do not know the name. Empty input shows everything.
 *
 * Matching is deliberately generous: the English name, the Arabic name and the
 * hint are all searched in both languages, so "pearl", "لؤلؤة", "porto" and
 * "qanat" all find The Pearl. Someone arriving in Doha who half-remembers
 * their hotel's district should not be defeated by spelling.
 *
 * Two sources feed the list. The curated areas always do. When a Google Maps
 * key is configured, Places suggestions are merged in above them, so a guest
 * can type their hotel or a street address rather than finding the nearest
 * district — that is the difference between "somewhere in Al Sadd" and the
 * building the driver pulls up outside.
 *
 * Google is strictly additive. The script is loaded lazily, every call fails
 * to an empty list, and a blocked or slow Maps API leaves the curated list
 * working exactly as it does with no key at all. If a customer types
 * something neither source recognises, they are offered WhatsApp with what
 * they typed — a destination we cannot price is a conversation, not an error.
 *
 * Either way the fare comes from coordinates resolved server-side; this field
 * never computes a price.
 *
 * The combobox follows the ARIA pattern rather than a div soup: real listbox
 * and option roles, aria-activedescendant for the virtual cursor, and a live
 * region announcing the number of matches. Booking funnels routinely fail
 * audits at exactly this control.
 */
export default function LocationPicker({
  value,
  onChange,
  label,
  id,
  invalid,
}: {
  /** The current destination, or null when nothing is chosen yet. */
  value: Destination | null
  onChange: (destination: Destination | null) => void
  label: string
  id: string
  invalid?: boolean
}) {
  const t = useTranslations()
  const language = useLanguage()
  const uid = useId()
  const listId = `${uid}-list`

  const sorted = useMemo(() => [...AREAS].sort((a, b) => a.order - b.order), [])

  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [places, setPlaces] = useState<PlaceSuggestion[]>([])
  const [resolving, setResolving] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  // One token per type-then-select cycle. Spent by resolvePlace, then replaced.
  const sessionRef = useRef<unknown>(undefined)

  const selectedLabel =
    value === null ? "" : value.kind === "area" ? areaName(value.area, language) : value.address

  // The input shows the chosen destination until the customer types again.
  const display = open ? query : selectedLabel

  const areaMatches = useMemo(() => {
    const q = normalise(query)
    if (!q) return sorted
    return sorted.filter((area) => searchText(area).includes(q))
  }, [query, sorted])

  /**
   * One flat list so the keyboard cursor, aria-activedescendant and the option
   * ids stay simple: Google's suggestions first (they are what the customer
   * typed towards), then the curated areas.
   */
  const options = useMemo(
    () => [
      ...places.map((p) => ({ kind: "place" as const, place: p })),
      ...areaMatches.map((a) => ({ kind: "area" as const, area: a })),
    ],
    [places, areaMatches]
  )

  useEffect(() => {
    setCursor(0)
  }, [query])

  // Load Maps on first focus, not on page load: most visits never reach this
  // field, and the script is not free.
  useEffect(() => {
    if (open && placesEnabled()) void loadPlaces()
  }, [open])

  // Ask Google as the customer types, debounced. Failures leave `places`
  // empty, which is simply the curated list.
  useEffect(() => {
    if (!placesEnabled()) return
    const q = query.trim()
    if (q.length < 3) {
      setPlaces([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const ready = await loadPlaces()
      if (!ready || cancelled) return
      if (!sessionRef.current) sessionRef.current = newSession()
      const found = await suggest(q, sessionRef.current)
      if (!cancelled) setPlaces(found)
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  // Clicking away closes the list without changing the selection.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  // Keep the active option in view when arrowing through a long list.
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLLIElement>(`#${CSS.escape(optionId(uid, cursor))}`)?.scrollIntoView({ block: "nearest" })
  }, [cursor, open, uid])

  function chooseArea(area: Area) {
    onChange({ kind: "area", area })
    setQuery("")
    setPlaces([])
    setOpen(false)
    inputRef.current?.focus()
  }

  /**
   * Ends the billing session: the Place Details call is what bundles every
   * keystroke in this session into one charge, and the token is discarded
   * afterwards so the next search starts a new one.
   */
  async function choosePlace(s: PlaceSuggestion) {
    setResolving(true)
    const resolved = await resolvePlace(s.id)
    sessionRef.current = undefined
    setResolving(false)

    // Outside Qatar, or Google gave us no coordinates: treat it as unfindable
    // rather than pricing a point we do not trust.
    if (!resolved || !inQatar(resolved.lat, resolved.lng)) {
      setPlaces([])
      setQuery(s.main)
      return
    }

    onChange({
      kind: "place",
      place_id: resolved.place_id,
      address: resolved.address || [s.main, s.secondary].filter(Boolean).join(", "),
      lat: resolved.lat,
      lng: resolved.lng,
    })
    setQuery("")
    setPlaces([])
    setOpen(false)
    inputRef.current?.focus()
  }

  function chooseAt(index: number) {
    const opt = options[index]
    if (!opt) return
    if (opt.kind === "area") chooseArea(opt.area)
    else void choosePlace(opt.place)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (!options.length) return
      setCursor((c) => (e.key === "ArrowDown" ? (c + 1) % options.length : (c - 1 + options.length) % options.length))
      return
    }
    if (e.key === "Enter") {
      if (open && options[cursor]) {
        e.preventDefault()
        chooseAt(cursor)
      }
      return
    }
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault()
        setQuery("")
        setOpen(false)
      }
      return
    }
    if (e.key === "Home" && open) {
      e.preventDefault()
      setCursor(0)
    }
    if (e.key === "End" && open) {
      e.preventDefault()
      setCursor(Math.max(0, options.length - 1))
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        // Off on purpose: iOS capitalises and corrects place names into
        // nonsense ("Msheireb" → "Mushier"), which breaks the search.
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[cursor] ? optionId(uid, cursor) : undefined}
        aria-invalid={invalid || undefined}
        aria-label={label}
        placeholder={t("search.destination.placeholder")}
        value={display}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (value) onChange(null)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={clx(
          "min-h-touch w-full rounded-dd border bg-dd-surface px-3 pe-9 text-base text-dd-ink",
          "placeholder:text-dd-muted focus:outline-none focus:ring-2 focus:ring-dd-focus focus:ring-offset-1 focus:ring-offset-dd-focus-gap",
          invalid ? "border-dd-danger" : "border-dd-line-strong"
        )}
      />

      {/* Chevron doubles as the "open the whole list" affordance. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => {
          setOpen((o) => !o)
          inputRef.current?.focus()
        }}
        className="absolute inset-y-0 end-0 flex w-9 items-center justify-center text-dd-grey"
      >
        <svg viewBox="0 0 20 20" className={clx("h-4 w-4 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Announced to screen readers on every keystroke, not rendered visually. */}
      <p className="sr-only" role="status" aria-live="polite">
        {open ? t("search.destination.results", { count: options.length }) : ""}
      </p>

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={label}
        hidden={!open}
        className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-dd border border-dd-line-strong bg-dd-surface py-1 shadow-float"
      >
        {options.map((opt, i) => {
          const primary = opt.kind === "area" ? areaName(opt.area, language) : opt.place.main
          const secondary = opt.kind === "area" ? areaHint(opt.area, language) : opt.place.secondary
          return (
            <li
              key={opt.kind === "area" ? opt.area.id : `p:${opt.place.id}`}
              id={optionId(uid, i)}
              role="option"
              aria-selected={i === cursor}
              // Pointer down, not click: click fires after blur closes the list.
              onMouseDown={(e) => {
                e.preventDefault()
                chooseAt(i)
              }}
              onMouseEnter={() => setCursor(i)}
              className={clx(
                "cursor-pointer px-3 py-2.5 text-start",
                i === cursor ? "bg-dd-accent-soft text-dd-ink" : "text-dd-ink-soft"
              )}
            >
              <span className="block text-base font-medium">{primary}</span>
              {secondary && <span className="block text-sm text-dd-muted">{secondary}</span>}
            </li>
          )
        })}

        {resolving && (
          <li role="option" aria-selected="false" aria-disabled="true" className="px-3 py-2.5 text-sm text-dd-muted">
            {t("common.loading")}…
          </li>
        )}

        {!options.length && !resolving && (
          <li className="px-3 py-3 text-sm text-dd-ink-soft" role="option" aria-selected="false" aria-disabled="true">
            <span className="block font-medium">{t("search.destination.noMatch")}</span>
            <a
              href={whatsappLink(t("search.destination.whatsappMessage", { place: query.trim() }))}
              target="_blank"
              rel="noopener noreferrer"
              onMouseDown={(e) => e.stopPropagation()}
              className="mt-1 inline-flex min-h-touch items-center font-semibold text-dd-accent-text underline underline-offset-4"
            >
              {t("search.destination.whatsappCta")}
            </a>
          </li>
        )}
      </ul>
    </div>
  )
}

const optionId = (uid: string, index: number) => `${uid}-opt-${index}`

/** Lowercase, strip Arabic diacritics and normalise alef/ya forms so search is forgiving. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ْٰ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    // Explicit ranges rather than \p{L}: the storefront's tsconfig targets
    // es5, where the unicode flag is unavailable.
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .trim()
}

/** Everything a customer might type to mean this area, in either language. */
function searchText(area: Area): string {
  return normalise([area.name_en, area.name_ar, area.hint_en, area.hint_ar, area.id.replace(/-/g, " ")].filter(Boolean).join(" "))
}
