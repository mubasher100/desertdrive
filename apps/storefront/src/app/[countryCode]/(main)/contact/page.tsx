import { Metadata } from "next"
import ProsePage from "@modules/common/components/prose-page"
import { getTranslations } from "@lib/i18n/get-translations"
import { localeOf, alternatesFor } from "@lib/util/locale"
import { getBaseURL } from "@lib/util/env"
import { CONTACT, whatsappLink } from "@lib/data/contact"

type Props = { params: Promise<{ countryCode: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  const alt = alternatesFor("/contact", getBaseURL())
  return {
    title: `${t("nav.contact")} — ${t("common.brand")}`,
    alternates: { canonical: alt.canonicalFor(countryCode), languages: alt.languages },
  }
}

export default async function ContactPage({ params }: Props) {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  const ar = localeOf(countryCode) === "ar"

  const items = [
    { label: t("nav.whatsapp"), value: CONTACT.phone.display, href: whatsappLink(), primary: true },
    { label: t("nav.call"), value: CONTACT.phone.display, href: `tel:${CONTACT.phone.e164}` },
    { label: ar ? "البريد الإلكتروني" : "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
  ]

  return (
    <ProsePage
      title={t("nav.contact")}
      intro={ar ? "متاحون على مدار الساعة للحجوزات والاستفسارات." : "Available around the clock for bookings and questions."}
    >
      <ul className="grid list-none gap-3 p-0 small:grid-cols-3">
        {items.map((i) => (
          <li key={i.label} className="m-0">
            <a
              href={i.href}
              className={
                i.primary
                  ? "flex min-h-[64px] flex-col justify-center rounded-dd-lg bg-dd-accent px-5 py-3 !text-dd-on-accent !no-underline hover:bg-dd-accent-strong"
                  : "flex min-h-[64px] flex-col justify-center rounded-dd-lg border border-dd-line bg-dd-surface px-5 py-3 !text-dd-ink !no-underline hover:bg-dd-paper"
              }
            >
              <span className={i.primary ? "text-xs uppercase tracking-wide text-dd-on-ink-2" : "text-xs uppercase tracking-wide text-dd-muted"}>
                {i.label}
              </span>
              <span className="text-base font-semibold">{i.value}</span>
            </a>
          </li>
        ))}
      </ul>
      <h2>{ar ? "الشركة" : "The company"}</h2>
      <p>
        {CONTACT.legalName} · {CONTACT.cr}
        <br />
        <span className="placeholder">{ar ? "[المالك: العنوان المسجّل]" : "[Owner: registered address]"}</span>
      </p>
    </ProsePage>
  )
}
