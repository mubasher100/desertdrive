import { getTranslations } from "@lib/i18n/get-translations"

const ITEMS = [
  { key: "licensed", icon: ShieldIcon },
  { key: "flight", icon: PlaneIcon },
  { key: "waiting", icon: ClockIcon },
  { key: "fixed", icon: TagIcon },
] as const

/**
 * Four reasons to trust us, directly under the hero. On a phone this is a
 * 2×2 grid so all four are visible in one screen; on desktop, a single row.
 */
export default function TrustStrip({ segment }: { segment: string }) {
  const t = getTranslations(segment)

  return (
    <section
      aria-label={t("trust.licensed.title")}
      className="border-b border-dd-line bg-dd-surface"
    >
      <ul className="mx-auto grid w-full max-w-content grid-cols-2 gap-x-4 gap-y-6 px-4 py-8 small:grid-cols-4 small:py-10">
        {ITEMS.map(({ key, icon: Icon }) => (
          <li key={key} className="flex gap-x-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-dd bg-dd-paper text-dd-grey"
            >
              <Icon />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-dd-ink">
                {t(`trust.${key}.title`)}
              </h2>
              <p className="mt-0.5 text-sm text-dd-muted">{t(`trust.${key}.body`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

const svgProps = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

function ShieldIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}
function PlaneIcon() {
  return (
    <svg {...svgProps}>
      <path d="M2.5 19.5l19-7.5-19-7.5v6l13 1.5-13 1.5z" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
function TagIcon() {
  return (
    <svg {...svgProps}>
      <path d="M20 13l-7 7-10-10V3h7l10 10z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  )
}
