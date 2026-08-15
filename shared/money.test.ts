import { describe, expect, it } from 'vitest'

import { MAX_PAISA, formatPaisa, groupWhileTyping, paisaToRupees, rupeesToPaisa } from './money'

describe('turning what someone typed into money', () => {
  it('keeps the half rupee a real contract is written in', () => {
    expect(rupeesToPaisa('6057704.50')).toBe(605770450)
    expect(rupeesToPaisa('908655.67')).toBe(90865567)
  })

  it('does not lose a paisa across a thousand rows', () => {
    // 0.1 + 0.2 is famously not 0.3. This is that, a thousand times, on the family's money.
    const asPaisa = Array.from({ length: 1000 }, () => rupeesToPaisa('0.07')).reduce((a, b) => a + b, 0)
    const asFloats = Array.from({ length: 1000 }, () => 0.07).reduce((a, b) => a + b, 0)

    expect(asPaisa).toBe(7000)
    expect(asFloats * 100).not.toBe(7000)
  })

  it('reads the commas people actually type', () => {
    expect(rupeesToPaisa('4,974,980')).toBe(497498000)
    expect(rupeesToPaisa(' 1,360,000 ')).toBe(136000000)
  })

  it('treats a whole number of rupees as exact', () => {
    expect(rupeesToPaisa('60000')).toBe(6000000)
    expect(rupeesToPaisa(60000)).toBe(6000000)
  })

  it('allows money coming back, which the workbooks are full of', () => {
    // Rora credited against the brick supplier; an overpayment returned.
    expect(rupeesToPaisa('-8500')).toBe(-850000)
  })

  describe('what it refuses', () => {
    it.each([
      ['nothing at all', ''],
      ['only spaces', '   '],
      ['words', 'sixty thousand'],
      ['a stray letter', '60000x'],
      ['more precision than money has', '100.005'],
      ['two decimal points', '1.2.3'],
      ['a lone minus', '-'],
      ['a number too large to be real money', '99999999999999'],
    ])('refuses %s', (_case, input) => {
      expect(() => rupeesToPaisa(input)).toThrow()
    })
  })
})

describe('turning money back into something readable', () => {
  it('writes it the way the workbooks write it', () => {
    expect(formatPaisa(497498000)).toBe('4,974,980')
  })

  it('shows the half rupee only when there is one', () => {
    expect(formatPaisa(605770450)).toBe('6,057,704.50')
    expect(formatPaisa(6000000)).toBe('60,000')
  })

  it('survives being read back in', () => {
    for (const typed of ['6057704.50', '4974980', '0.07', '-8500', '908655.67']) {
      const once = rupeesToPaisa(typed)
      expect(rupeesToPaisa(formatPaisa(once))).toBe(once)
    }
  })

  it('gives rupees back as a number only where a number is wanted', () => {
    expect(paisaToRupees(605770450)).toBeCloseTo(6057704.5, 2)
  })

  it('refuses an amount past the largest it keeps track of', () => {
    expect(() => rupeesToPaisa(String(MAX_PAISA / 100 + 1))).toThrow()
  })
})

describe('commas while an amount is typed', () => {
  it('groups as the digits arrive', () => {
    expect(groupWhileTyping('4974980')).toBe('4,974,980')
    expect(groupWhileTyping('49')).toBe('49')
  })

  it('lets a half-typed amount stay half-typed', () => {
    // A lone dot is on the way to 0.5, and refusing it mid-keystroke is how a form fights the person filling it in.
    expect(groupWhileTyping('1000.')).toBe('1,000.')
    expect(groupWhileTyping('.')).toBe('.')
    expect(groupWhileTyping('')).toBe('')
  })

  it('leaves what is already grouped alone', () => {
    expect(groupWhileTyping('4,974,980')).toBe('4,974,980')
    expect(groupWhileTyping('6,057,704.50')).toBe('6,057,704.50')
  })

  it('never keeps more than two figures after the dot, because that is what a paisa is', () => {
    expect(groupWhileTyping('10.999')).toBe('10.99')
  })

  it('drops anything that is not part of an amount', () => {
    expect(groupWhileTyping('Rs 49,150/-')).toBe('49,150')
  })
})
