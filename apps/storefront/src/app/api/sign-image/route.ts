import { NextResponse } from "next/server"

/** Mirrors the backend's cap, so an oversized body is refused before it is forwarded. */
const MAX_BYTES = 5 * 1024 * 1024

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/sign-image — forwards a meet & greet sign picture to the backend.
 *
 * A route handler rather than a direct browser call to Medusa. The rule in
 * CLAUDE.md is "frontends talk to the Store API through the SDK, never bare
 * fetch" and the REASON is that the SDK attaches the publishable key; the SDK
 * has no multipart upload, so this does the same job the same way — the key
 * and the backend URL stay on the server, and the browser posts same-origin.
 *
 * It decides nothing. The backend sniffs the bytes, enforces the allowlist and
 * the rate limit, and names the stored file. This only refuses what is
 * obviously not worth a round trip.
 */
export async function POST(request: Request) {
  const backend = process.env.MEDUSA_BACKEND_URL
  const key = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  if (!backend || !key) {
    return NextResponse.json({ message: "Upload is not configured." }, { status: 503 })
  }

  // Cheap rejection on the declared length. The real check is on the bytes,
  // in the backend, because this header is client-supplied.
  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > MAX_BYTES * 1.1) {
    return NextResponse.json({ message: "That image is too large." }, { status: 413 })
  }

  try {
    const form = await request.formData()
    const file = form.get("file")

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ message: "No image was uploaded." }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ message: "That image is too large." }, { status: 413 })
    }

    // Rebuilt rather than streamed through, so only the one part this route
    // knows about reaches the backend.
    const forward = new FormData()
    forward.append("file", file, "upload")

    const res = await fetch(`${backend}/store/sign-image`, {
      method: "POST",
      headers: {
        "x-publishable-api-key": key,
        // Content-Type is deliberately unset: fetch writes it, with the
        // multipart boundary, which cannot be written by hand correctly.
        ...(request.headers.get("x-forwarded-for")
          ? { "x-forwarded-for": request.headers.get("x-forwarded-for")! }
          : {}),
      },
      body: forward,
      cache: "no-store",
    })

    const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string }

    if (!res.ok || !data.url) {
      return NextResponse.json(
        { message: data.message ?? "The image could not be stored." },
        { status: res.status === 200 ? 502 : res.status }
      )
    }

    return NextResponse.json({ url: data.url }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ message: "The image could not be stored." }, { status: 502 })
  }
}
