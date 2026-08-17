// A small count said as a word, because that is how his drawing says one: `Three active sites`, `Two working days with no entries`. Digits are for figures -- an amount, a cheque number, a count of entries under a tile -- and a sentence opening with `3` reads as a figure that lost its rupees.

// It stops at ten on purpose. Past that a word is longer than the thing it is counting and nobody writes `forty-seven`; his own drawing has `Across 47 entries` and `Owed to 4 suppliers`, which is the same line drawn in the same place.
const SAID = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'] as const

/** `3` said as `Three`, up to ten. Anything larger, or anything that is not a whole count, comes back as digits. */
export function inWords(count: number): string {
  const said = Number.isInteger(count) && count >= 0 ? SAID[count] : undefined

  return said ?? String(count)
}

/** The same, lower case, for the middle of a sentence. */
export function inWordsMidSentence(count: number): string {
  const said = inWords(count)

  return said === String(count) ? said : said.toLowerCase()
}
