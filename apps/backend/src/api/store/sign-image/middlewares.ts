import { MiddlewareRoute } from "@medusajs/framework"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import multer from "multer"
import { MAX_IMAGE_BYTES } from "../../../lib/image-upload"

/**
 * In memory, one file, hard size cap.
 *
 * Memory rather than disk on purpose: the route sniffs the bytes and hands
 * them straight to the file module, so a temp file would only add a path on
 * the server that has to be cleaned up and can be raced.
 *
 * The limits are enforced by multer BEFORE the body is buffered, which is the
 * point — a 500 MB POST is refused mid-stream rather than after it has been
 * read into the process. The route checks the size again anyway, because two
 * cheap checks on a public endpoint are better than trusting one.
 *
 * ⚠️ `parts` is 2, not 1. A part count of 1 rejects even a single well-formed
 * upload with LIMIT_PART_COUNT — busboy's accounting is not "one file, one
 * part" — so the endpoint returned 500 for EVERY request and none of the
 * validation below it ever ran. `files: 1` and `fields: 0` are what actually
 * constrain this; `parts` is the backstop, and it has to leave room to work.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
    // No text fields are read from this request; the note travels with the cart.
    fields: 0,
    parts: 2,
  },
})

/**
 * Turns multer's own failures into answers a person can act on.
 *
 * ⚠️ Multer is invoked by hand rather than listed as a middleware, because
 * Medusa does not support Express's 4-argument error handler: it wraps every
 * entry in `middlewares` and calls it as `(req, res, next)`, so an `(err, req,
 * res, next)` function receives the REQUEST as its `err` and `undefined` as
 * its `next`, and fails with "next is not a function" on every single
 * request. Handling the error in multer's own callback keeps this a normal
 * three-argument middleware.
 *
 * Without this, multer's failures surface as a bare 500 "unknown error" —
 * which is exactly how the part-count bug above stayed invisible: a broken
 * endpoint and an oversized file looked identical from outside.
 *
 * ⚠️ `multer` is a DECLARED dependency of this app, not one borrowed from
 * Medusa's tree. It resolved either way on a dev machine, which is why the
 * omission was invisible locally and only surfaced on CI's clean install —
 * and a Medusa upgrade that moved or dropped it would have broken the build
 * with no change of ours to blame.
 */
const single = upload.single("file")

function readImage(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  single(req as never, res as never, (err: unknown) => {
    if (!err) {
      next()
      return
    }

    if (err instanceof multer.MulterError) {
      res.status(400).json({
        type: "invalid_data",
        message:
          err.code === "LIMIT_FILE_SIZE"
            ? "That image is too large. Please use one under 5 MB."
            : "That upload could not be read. Please choose a single image file.",
      })
      return
    }

    next(err as Error)
  })
}

export const signImageMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/sign-image",
    middlewares: [readImage],
  },
]
