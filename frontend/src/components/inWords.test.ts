import { describe, expect, it } from 'vitest'

import { inWords, inWordsMidSentence } from './inWords'

describe('a count said as a word', () => {
  it('says the small ones the way a person says them', () => {
    expect(inWords(1)).toBe('One')
    expect(inWords(2)).toBe('Two')
    expect(inWords(3)).toBe('Three')
    expect(inWords(10)).toBe('Ten')
  })

  // A sentence saying `0 sites` reads as a figure that has lost its rupees. `No sites` is the sentence.
  it('says none as a word too', () => {
    expect(inWords(0)).toBe('No')
    expect(inWordsMidSentence(0)).toBe('no')
  })

  it('hands back digits past ten, where nobody writes the word', () => {
    expect(inWords(11)).toBe('11')
    expect(inWords(47)).toBe('47')
    expect(inWordsMidSentence(47)).toBe('47')
  })

  // Nothing should ever hand this a fraction, and a screen that does must not print `undefined` in the middle of a sentence.
  it('hands back anything that is not a whole count', () => {
    expect(inWords(2.5)).toBe('2.5')
    expect(inWords(-1)).toBe('-1')
    expect(inWords(Number.NaN)).toBe('NaN')
  })

  it('lowers only the words it actually said', () => {
    expect(inWordsMidSentence(3)).toBe('three')
    expect(inWordsMidSentence(10)).toBe('ten')
  })
})
