import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import { MAX_IMAGE_BYTES, sniffImage } from "../../../lib/image-upload"

/** Uploads per IP per window. Generous for a person, useless as a dumping ground. */
const RATE_LIMIT = 10
const RATE_WINDOW_SECONDS = 60 * 60

type CacheModule = {
  get: <T>(key: string) => Promise<T | null>
  set: (key: string, value: unknown, ttl?: number) => Promise<void>
}

/**
 * The caller's address, taken from the proxy header Cloudflare and Railway set.
 *
 * Spoofable if the backend is ever reachable without a proxy in front, which is
 * why this only drives a rate limit and never an authorisation decision.
 */
function callerIp(req: MedusaRequest): string {
  const forwarded = req.headers["x-forwarded-for"]
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]
  return (first || req.socket?.remoteAddress || "unknown").trim()
}

/**
 * POST /store/sign-image
 *
 * Takes the picture a customer wants printed on their meet & greet sign and
 * returns the URL it was stored at. That URL goes onto the booking; the owner
 * opens it from the admin to print the board.
 *
 * ⚠️ This is the ONLY public, unauthenticated write on the site, and it writes
 * to storage the business pays for. Everything below is because of that:
 *
 *  - the bytes decide the type, never the client's Content-Type or filename
 *  - three raster formats only, and **never SVG** — it is XML that can carry
 *    script, and the owner opens these URLs while logged into the admin
 *  - the stored name is generated here; the client's filename is discarded
 *    rather than sanitised, because there is nothing in it worth keeping
 *  - 5 MB, and a per-IP hourly cap so the bucket cannot be used as free storage
 *  - it refuses outright when no bucket is configured, rather than falling back
 *    to local disk, which on Railway is wiped by the next deploy
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  /**
   * No storage, no upload. The default `file-local` provider would accept this
   * happily and write to a container filesystem that does not survive a deploy
   * — a booking paid for with a sign picture that is simply gone. Refusing is
   * the recoverable failure.
   */
  let fileModule: unknown
  try {
    fileModule = req.scope.resolve(Modules.FILE)
  } catch {
    fileModule = null
  }
  if (!fileModule || !process.env.UPLOADS_S3_BUCKET) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Image upload is not configured on this server."
    )
  }

  // --- rate limit, before reading a byte of the body -----------------------
  const cache = req.scope.resolve(Modules.CACHE) as CacheModule
  const key = `sign-image:${callerIp(req)}`
  const used = (await cache.get<number>(key).catch(() => null)) ?? 0

  if (used >= RATE_LIMIT) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Too many uploads. Please try again later, or send the picture on WhatsApp."
    )
  }

  // --- the file ------------------------------------------------------------
  // Only the two fields this route reads are declared. `Express.Multer.File`
  // needs @types/multer's global augmentation, which is not in the backend's
  // type graph — and nothing else on that type is wanted here anyway.
  const file = (req as MedusaRequest & { file?: { buffer?: Buffer } }).file

  if (!file?.buffer?.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "No image was uploaded.")
  }

  if (file.buffer.length > MAX_IMAGE_BYTES) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "That image is too large. Please use one under 5 MB."
    )
  }

  /**
   * The bytes, not the label. A file named `logo.png` and declared
   * `image/png` is a PNG only if it starts like one.
   */
  const kind = sniffImage(file.buffer)

  if (!kind) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "That file is not a JPEG, PNG or WebP image."
    )
  }

  // Our name, not theirs. Nothing the client sent is echoed into a path.
  const name = `${Date.now()}-${crypto.randomUUID()}.${kind.ext}`

  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: [
        {
          filename: name,
          mimeType: kind.mime,
          content: file.buffer.toString("binary"),
          access: "public",
        },
      ],
    },
  })

  const uploaded = result?.[0]

  if (!uploaded?.url) {
    logger.error("sign-image: upload returned no url")
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "The image could not be stored.")
  }

  // Counted only on success, so a rejected file does not spend someone's quota.
  await cache.set(key, used + 1, RATE_WINDOW_SECONDS).catch(() => {})

  res.setHeader("Cache-Control", "no-store")
  res.json({ url: uploaded.url })
}
