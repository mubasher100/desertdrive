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
 * The dollar figure a customer reads, to the cent.
 *
 * Cents rather than whole dollars on purpose: the price is SET in riyals, so
 * the dollar figure is a conversion of it. Rounding 100 QAR to "$27" understates
 * what the card is charged by nearly half a dollar, and Qatar's Consumer
 * Protection Law is explicit that the price shown is the price charged. The
 * exact figure plus the riyal total alongside it keeps that true.
 */
export function formatUsd(qar: number): string {
  return `$${usdFromQar(qar).toFixed(2)}`
}

/** The riyal figure, in Western digits in both languages — see the i18n notes. */
export function formatQar(qar: number, currencyLabel: string): string {
  return `${qar} ${currencyLabel}`
}
