import { readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

/**
 * `medusa build` silently leaves out any folder named test, unit-tests or
 * integration-tests (backendIgnoreFiles in @medusajs/framework's compiler).
 * A route at api/admin/push/test/route.ts therefore worked locally, passed
 * every check, and answered 404 in production — the owner's "Send test
 * notification" failed on an iPhone with "HTTP 404" (18 Nov 2026).
 *
 * This fails instead, naming the folder.
 */
const IGNORED = new Set(["test", "unit-tests", "integration-tests"])

function folders(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (!statSync(full).isDirectory()) return []
    return [full, ...folders(full)]
  })
}

describe("folders medusa build would drop", () => {
  it("no backend source folder is named test, unit-tests or integration-tests", () => {
    const src = join(__dirname, "..", "..")
    const dropped = folders(src)
      .filter((f) => !relative(src, f).startsWith("admin"))
      .filter((f) => IGNORED.has(f.split(/[\\/]/).pop()!))
      .map((f) => relative(src, f))
    expect(dropped).toEqual([])
  })
})
