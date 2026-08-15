// Whole paisa: one real contract is 6,057,704.50, and floats lose fractions across thousands of rows.

// Rs 10,000,000,000. Far above the largest figure in ten years of workbooks, a plot at Rs 41,475,000.
export const MAX_PAISA = 1_000_000_000_000

const TYPED_AMOUNT = /^-?\d+(\.\d{1,2})?$/

// Two different mistakes, kept apart: something that is not an amount at all, and an amount too large to hold. Whoever asks decides what to say about each, because "that is not a number" is a lie told to somebody who typed one.
export type AmountRead = { ok: true; paisa: number } | { ok: false; why: 'notAnAmount' | 'largerThanWeKeep' }

export function readRupees(input: string | number): AmountRead {
  const text = String(input).trim().replaceAll(',', '')

  if (!TYPED_AMOUNT.test(text)) {
    return { ok: false, why: 'notAnAmount' }
  }

  const negative = text.startsWith('-')
  const [whole, fraction = ''] = text.replace('-', '').split('.')
  const paisa = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))

  if (!Number.isSafeInteger(paisa) || paisa > MAX_PAISA) {
    return { ok: false, why: 'largerThanWeKeep' }
  }

  return { ok: true, paisa: negative ? -paisa : paisa }
}

export function rupeesToPaisa(input: string | number): number {
  const read = readRupees(input)

  if (!read.ok) {
    throw new Error(
      read.why === 'largerThanWeKeep'
        ? 'That amount is larger than this keeps track of.'
        : 'That is not an amount of money.'
    )
  }

  return read.paisa
}

export function paisaToRupees(paisa: number): number {
  return paisa / 100
}

// Commas appear as an amount is typed, so the screen matches the workbooks before anything is saved.

// Half-typed text has to survive, because a lone "." is on the way to "0.5" and refusing it mid-keystroke is a form fighting the person filling it in.
export function groupWhileTyping(typed: string): string {
  const digitsOnly = typed.replace(/[^\d.]/g, '')
  const [whole = '', ...rest] = digitsOnly.split('.')

  const grouped = whole === '' ? '' : Number(whole).toLocaleString('en-US')
  if (rest.length === 0) {
    return grouped
  }

  // Only ever two, because that is what a paisa is, and the rest is a slip nobody meant.
  return `${grouped}.${rest.join('').slice(0, 2)}`
}

export function formatPaisa(paisa: number): string {
  const negative = paisa < 0
  const absolute = Math.abs(paisa)
  const whole = Math.trunc(absolute / 100)
  const fraction = absolute % 100

  const grouped = whole.toLocaleString('en-US')
  const shown = fraction === 0 ? grouped : `${grouped}.${String(fraction).padStart(2, '0')}`

  return negative ? `-${shown}` : shown
}
