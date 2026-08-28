import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.css"

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
    <html lang="en" dir="ltr" data-mode="light">
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
