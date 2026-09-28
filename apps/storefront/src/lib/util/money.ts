/**
 * Prices are shown in US dollars and charged in Qatari riyals.
 *
 * The customer is usually abroad, booking the night before a flight, and
 * thinks in dollars; SkipCash is a Qatari gateway and settles in riyals. So
 * the catalogue stays in QAR — one currency, the one the money actually moves
 * in — and USD is derived for display only.
 *
 * ⚠️ THE RATE IS A PEG, NOT A MARKET RATE. The Qatar Central Bank has fixed
 * the riyal at 3.64 to the dollar since 2001. That is why there is no rate
 * feed, no daily refresh job and no stale-rate problem here: a live lookup
 * would fetch the same number every day, add a dependency that can fail
 * mid-booking, and invite a cache that could serve a wrong price. A constant
 * is not a shortcut, it is the accurate model.
 *
 * If the peg is ever changed or floated, this constant is the single thing to
 * update — and the decision about what to do then is the owner's, because a
 * float would mean the displayed price and the charged price could drift apart
 * between the results page and the card form.
 */
export const QAR_PER_USD = 3.64

/** Riyals to dollars. Not rounded — the caller decides how to present it. */
export function usdFromQar(qar: number): number {
  return qar / QAR_PER_USD
}

/**
 * The dollar figure a customer reads.
 *
 * Whole dollars print without cents — "$17", not "$17.00". Every fare is set
 * in whole dollars (the owner's ask, 29 Sept 2026: src/data/price-book.ts in
 * the backend), so this is the normal case; doubled fares, returns and the $5
 * extras all stay whole. Anything that is not whole — the 1 QAR test vehicle,
 * a price the owner types into the admin in riyals — keeps its cents rather
 * than being rounded, because Qatar's Consumer Protection Law wants the price
 * shown to be the price charged.
 *
 * Rounded to the cent first: 61.88 / 3.64 is 16.9999999…, which is $17.
 */
export function formatUsd(qar: number): string {
  const cents = Math.round(usdFromQar(qar) * 100)
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`
}

/**
 * The riyal figure, in Western digits in both languages — see the i18n notes.
 *
 * To the fils: a $17 fare is charged as 61.88 QAR, and a sum of such figures
 * must print as "123.76", never as floating-point noise like 123.75999999.
 * A whole riyal amount still prints without decimals.
 */
export function formatQar(qar: number, currencyLabel: string): string {
  const fils = Math.round(qar * 100)
  const text = fils % 100 === 0 ? String(fils / 100) : (fils / 100).toFixed(2)
  return `${text} ${currencyLabel}`
}
