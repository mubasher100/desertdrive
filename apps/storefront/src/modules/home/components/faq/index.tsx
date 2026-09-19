import { getTranslations } from "@lib/i18n/get-translations"

const QUESTIONS = [1, 2, 3, 4, 5] as const

/**
 * FAQ as native <details>/<summary>.
 *
 * Chosen over a Radix accordion deliberately: it is keyboard-operable and
 * announced correctly by screen readers with no JavaScript, it needs no ARIA
 * wiring, and it sidesteps the trap CLAUDE.md flags where Radix renders the
 * trigger as an <h3> and skips a heading level under the page's <h1>. The
 * heading level here is explicit.
 */
export default function Faq({ segment }: { segment: string }) {
  const t = getTranslations(segment)

  return (
    <section className="mx-auto w-full max-w-content px-4 py-12 small:py-16">
      <h2 className="text-2xl font-semibold text-dd-ink small:text-3xl">
        {t("home.faq.title")}
      </h2>
      <div className="mt-6 divide-y divide-dd-line border-y border-dd-line">
        {QUESTIONS.map((n) => (
          <details key={n} className="group">
            <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-medium text-dd-ink [&::-webkit-details-marker]:hidden">
              <h3 className="text-base font-medium">{t(`home.faq.${n}.q`)}</h3>
              <Chevron />
            </summary>
            <p className="pb-5 pe-10 text-sm text-dd-muted">
              {t(`home.faq.${n}.a`)}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 text-dd-grey transition-transform group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
