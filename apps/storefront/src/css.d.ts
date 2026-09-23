/**
 * CSS imported from JavaScript.
 *
 * Next bundles these as a side effect; TypeScript only needs to be told they
 * resolve. Declared here so `await import("leaflet/dist/leaflet.css")` inside
 * the map picker typechecks — the map's stylesheet loads with the map, not
 * with every page.
 */
declare module "*.css"
