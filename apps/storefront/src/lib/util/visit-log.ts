import type { NextRequest } from "next/server"

/**
 * One security log line per page visit: who connected, from roughly where,
 * and which page. Written with console.log, which Cloudflare's Workers Logs
 * keep for a few days (observability is enabled in wrangler.jsonc) — the
 * owner reads them at Workers & Pages → desertdrive → Logs, and can filter by
 * `visit.ip` to follow one visitor.
 *
 * What is deliberately NOT logged:
 *  - the query string. It carries the booking destination — a hotel, a home
 *    address, its coordinates — and a security log has no use for where
 *    someone is going.
 *  - cookies, and anything typed into a form.
 *
 * ⚠️ IP location is approximate. It names the city and the network (often
 * "Doha, Ooredoo" for every mobile user in the country), never a person or an
 * address. Qatar's data-protection law treats IP addresses as personal data;
 * /privacy says these logs exist, why, and how long they last.
 *
 * Never throws. A logging failure must not turn into a page that will not load.
 */
export async function logVisit(request: NextRequest): Promise<void> {
  try {
    const h = request.headers
    let cf: Record<string, unknown> = {}
    try {
      // Cloudflare's own lookup of the connecting IP: city, region, network.
      // Absent in local dev and during the build, which is fine.
      const { getCloudflareContext } = await import("@opennextjs/cloudflare")
      cf = ((await getCloudflareContext({ async: true })).cf ?? {}) as Record<string, unknown>
    } catch {
      cf = {}
    }

    console.log(
      JSON.stringify({
        visit: {
          ip: h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
          country: (cf.country as string) ?? h.get("cf-ipcountry") ?? null,
          city: (cf.city as string) ?? null,
          region: (cf.region as string) ?? null,
          network: (cf.asOrganization as string) ?? null,
          asn: (cf.asn as number) ?? null,
          path: request.nextUrl.pathname,
          method: request.method,
          user_agent: h.get("user-agent")?.slice(0, 200) ?? null,
          referer: h.get("referer")?.split("?")[0] ?? null,
        },
      })
    )
  } catch {
    // never let a log line break a page
  }
}
