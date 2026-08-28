# Drop the brand assets here

The palette is derived from the real logo. Nothing in this project invents one,
so the storefront stays visually unstyled until these land.

## Needed

| File | Format | Notes |
|---|---|---|
| `logo.svg` | SVG preferred | The primary mark. SVG lets the colours be sampled exactly and scales on a phone without a second asset. |
| `logo.png` | PNG, ≥1000px wide, transparent | Only if there is no SVG. |
| `logo-mark.svg` | SVG | Just the symbol without the wordmark, if one exists — used for the favicon and the sticky mobile header. |

If the only copy of the logo is inside a PDF, a business card or a signwriting
proof, that is still more useful than a guess. Send it and say so.

## What happens next

The colours get sampled from the mark and written to
`apps/storefront/src/styles/brand.css` as CSS variables, with the measured
contrast ratio recorded next to each token that carries text.

Every token that carries body text must clear **4.5:1** against its background
for WCAG AA. On a sand or desert palette this is a live risk — light warm tones
on white commonly land near 3:1 and fail. Where a brand colour cannot carry text
it is kept for fills and borders, and a darker companion token is derived for
text. That is a normal outcome, not a rejection of the brand.
