import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import LanguageSwitcher from "@modules/layout/components/language-switcher"
import { getTranslations } from "@lib/i18n/get-translations"
import { CONTACT, whatsappLink } from "@lib/data/contact"

export default async function Footer({ segment }: { segment: string }) {
  const t = getTranslations(segment)
  const year = new Date().getFullYear()

  return (
    <footer className="mt-16 border-t border-dd-line bg-dd-paper">
      <div className="mx-auto w-full max-w-content px-4 py-10">
        <div className="grid gap-10 small:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Image
              src="/brand/logo-transparent.png"
              alt={t("common.brand")}
              width={608}
              height={293}
              className="h-10 w-auto"
            />
            <p className="mt-3 text-sm text-dd-muted">{t("footer.tagline")}</p>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-dd-muted">
              {t("footer.contact")}
            </h2>
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                <a href={`tel:${CONTACT.phone.e164}`} className={footerLink}>
                  {CONTACT.phone.display}
                </a>
              </li>
              <li>
                <a
                  href={whatsappLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={footerLink}
                >
                  {t("nav.whatsapp")}
                </a>
              </li>
              <li>
                <a href={`mailto:${CONTACT.email}`} className={footerLink}>
                  {CONTACT.email}
                </a>
              </li>
              <li>
                <LocalizedClientLink href="/contact" className={footerLink}>
                  {t("nav.contact")}
                </LocalizedClientLink>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-dd-muted">
              {t("footer.legal")}
            </h2>
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                <LocalizedClientLink href="/terms" className={footerLink}>
                  {t("footer.terms")}
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink href="/cancellation" className={footerLink}>
                  {t("footer.cancellation")}
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink href="/privacy" className={footerLink}>
                  {t("footer.privacy")}
                </LocalizedClientLink>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-dd-line pt-6 text-xs text-dd-muted small:flex-row small:items-center small:justify-between">
          <p>
            © {year} {CONTACT.legalName} · {CONTACT.cr} · {t("footer.rights")}
            <span className="block small:inline small:before:content-['·'] small:before:mx-2">
              {t("footer.photoCredit")}{" "}
              <a
                href="https://commons.wikimedia.org/wiki/File:Doha_Corniche_Skyline_View_2.jpg"
                target="_blank"
                rel="noopener noreferrer license"
                className="underline underline-offset-2 hover:text-dd-ink"
              >
                Zairon, CC BY 4.0
              </a>
            </span>
          </p>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  )
}

const footerLink =
  "inline-flex min-h-touch items-center text-dd-ink-soft hover:text-dd-ink"
