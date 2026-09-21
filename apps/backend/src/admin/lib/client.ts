import Medusa from "@medusajs/js-sdk"

/**
 * The admin is served by the backend itself at /app, so requests go to the
 * same origin. (The usual `import.meta.env.VITE_BACKEND_URL` form is not used:
 * the backend's tsconfig compiles to CommonJS and rejects `import.meta`.)
 */
export const sdk = new Medusa({
  baseUrl: "/",
  auth: {
    type: "session",
  },
})
