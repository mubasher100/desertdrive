# Drop the vehicle photography here

Used on the results page, where the customer chooses between vehicle classes.
Until these land, the cards render sized placeholders — so replacing them later
does not move the layout.

## Needed

One or more photos per class:

| File | Class |
|---|---|
| `sedan.jpg` | Sedan (with driver) — 3 passengers, 2 bags |
| `large-suv.jpg` | Large SUV (with driver) — 6 passengers, 4 bags |
| `minivan.jpg` | Minivan (with driver) — 7 passengers, 6 bags |

## What they need to be

- **Landscape**, roughly 3:2. The card is wider than it is tall at every
  breakpoint.
- **At least 1200px wide.** They get resized down for mobile, never up.
- **The actual vehicles**, if at all possible. Stock photos of a car that does
  not turn up at the airport is the kind of thing that generates complaints.
- Consistent angle across the three, so the results page reads as one set rather
  than three unrelated pictures. Three-quarter front is the usual choice.

The primary user is booking on a phone, often on roaming or hotel wifi, so these
are served resized and in a modern format. Send the largest originals available
and let the build do the shrinking — do not pre-compress them.
