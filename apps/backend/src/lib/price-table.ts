/**
 * The cars on the owner's price table, in the order the table shows them.
 * The handles are the products' — the five classes on sale.
 */
export const PRICE_TABLE_CLASSES = [
  { handle: "sedan", title: "Sedan" },
  { handle: "suv", title: "SUV" },
  { handle: "large-van", title: "Large van" },
  { handle: "luxury-sedan", title: "S-Class" },
  { handle: "luxury-van", title: "V-Class" },
] as const

export type PriceTableClass = (typeof PRICE_TABLE_CLASSES)[number]["handle"]
