// Whole paisa: one real contract is 6,057,704.50, and floats lose fractions across thousands of rows.

// Rs 10,000,000,000. Far above the largest figure in ten years of workbooks, a plot at Rs 41,475,000.
export const MAX_PAISA = 1_000_000_000_000

const TYPED_AMOUNT = /^-?\d+(\.\d{1,2})?$/

export function rupeesToPaisa(input: string | number): number {
  const text = String(input).trim().replaceAll(',', '')

  if (!TYPED_AMOUNT.test(text)) {
    throw new Error('That is not an amount of money.')
  }

  const negative = text.startsWith('-')
  const [whole, fraction = ''] = text.replace('-', '').split('.')
  const paisa = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))

  if (!Number.isSafeInteger(paisa) || paisa > MAX_PAISA) {
    throw new Error('That amount is larger than this keeps track of.')
  }

  return negative ? -paisa : paisa
}

export function paisaToRupees(paisa: number): number {
  return paisa / 100
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
