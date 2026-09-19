import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import { Geist, IBM_Plex_Sans_Arabic } from "next/font/google"
import localFont from "next/font/local"
import "styles/globals.css"

/**
 * Both scripts' fonts are loaded here, once, as CSS variables that brand.css
 * picks up. next/font self-hosts them at build time: no request to Google at
 * runtime, no layout shift, and they work inside the Cloudflare Worker.
 *
 * Both are loaded on every page rather than per locale because the language
 * switcher is a client-side navigation — loading the Arabic face only on
 * /ar-qa would flash fallback glyphs on the first switch.
 */
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
})

/**
 * Google Sans Flex is served by Google Fonts but is newer than the list baked
 * into this Next version's next/font/google, so it is self-hosted: the
 * variable woff2 (latin subset, weights 300–800) lives in src/fonts.
 */
const googleSansFlex = localFont({
  src: "../fonts/GoogleSansFlex-latin.woff2",
  weight: "300 800",
  variable: "--font-google-sans-flex",
  display: "swap",
})

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

/**
 * Sets `lang` and `dir` from the URL before first paint.
 *
 * The root layout gets no route params — the locale lives one level down, in
 * `[countryCode]` — so the only way to know the language here is to read the
 * URL. Doing this in an effect instead would render the whole page left-to-right
 * and then flip it, which is very visible in Arabic.
 *
 * This runs once per document load. `DirectionSync` in the locale layout keeps
 * the two attributes correct across client-side navigation after that.
 *
 * Kept deliberately tiny and dependency-free: it blocks first paint.
 */
const SET_DIRECTION_BEFORE_PAINT = `
(function () {
  try {
    var seg = location.pathname.split("/")[1] || "";
    var lang = seg.split("-")[0].toLowerCase();
    if (lang !== "ar" && lang !== "en") { lang = "en"; }
    var el = document.documentElement;
    el.lang = lang;
    el.dir = lang === "ar" ? "rtl" : "ltr";
  } catch (e) {}
})();
`

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    // These are the pre-hydration defaults. The script above corrects them from
    // the URL before paint, and DirectionSync maintains them thereafter.
    //
    // suppressHydrationWarning is required, not cosmetic: on /ar-qa the script
    // has already set lang="ar" dir="rtl" by the time React hydrates, so React
    // sees attributes that differ from what the server rendered and logs an
    // error on every Arabic page load. The mismatch is intentional and React
    // leaves the DOM alone either way; this just stops it being reported as a
    // bug. It applies to this element's own attributes only, not its children.
    <html
      lang="en"
      dir="ltr"
      data-mode="light"
      className={`${geist.variable} ${googleSansFlex.variable} ${plexArabic.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: SET_DIRECTION_BEFORE_PAINT }}
        />
      </head>
      <body>
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
