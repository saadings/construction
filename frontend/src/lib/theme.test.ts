// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { HowItLooks } from './theme'
import { HOW_IT_LOOKS, THEME_INIT_SCRIPT, applyHowItLooks, howItLooksNow, useHowItLooks, usePrefersDark } from './theme'

// Three states, and the two quiet failures are the same either way: nothing listening, and the head script disagreeing with what the app does a frame later. Both are asserted on the real `<html>`.

// jsdom here provides no storage at all, so it is put in rather than assumed -- and a phone with storage turned off is a real case, tested below.
function stubStorage(): void {
  const held = new Map<string, string>()

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => held.get(key) ?? null,
    setItem: (key: string, value: string) => held.set(key, value),
    removeItem: (key: string) => held.delete(key),
    clear: () => held.clear(),
  })
}

type SchemeListener = () => void

function stubDevicePreference(startsDark: boolean) {
  let prefersDark = startsDark
  const listeners = new Set<SchemeListener>()
  const queriesAsked: Array<string> = []

  vi.stubGlobal('matchMedia', (query: string) => {
    queriesAsked.push(query)

    return {
      get matches() {
        return prefersDark
      },
      addEventListener: (_event: string, listener: SchemeListener) => {
        listeners.add(listener)
      },
      removeEventListener: (_event: string, listener: SchemeListener) => {
        listeners.delete(listener)
      },
    }
  })

  return {
    change(toDark: boolean) {
      prefersDark = toDark
      for (const listener of listeners) {
        listener()
      }
    },
    listenerCount: () => listeners.size,
    queriesAsked: () => queriesAsked,
  }
}

function theHtml() {
  return {
    theme: document.documentElement.getAttribute('data-theme'),
    className: document.documentElement.className,
    colorScheme: document.documentElement.style.colorScheme,
  }
}

function wipeTheHtml() {
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.className = ''
  document.documentElement.style.colorScheme = ''
}

beforeEach(stubStorage)

afterEach(() => {
  vi.unstubAllGlobals()
  wipeTheHtml()
})

describe('following the device', () => {
  it('reads what the device is asking for', () => {
    const device = stubDevicePreference(true)

    const { result } = renderHook(() => usePrefersDark())

    expect(result.current).toBe(true)
    expect(device.queriesAsked()).toContain('(prefers-color-scheme: dark)')
  })

  it('follows the device when it changes while the app is open', () => {
    const device = stubDevicePreference(false)

    const { result } = renderHook(() => usePrefersDark())
    expect(result.current).toBe(false)

    act(() => {
      device.change(true)
    })

    expect(result.current).toBe(true)
  })

  it('stops listening once the app is gone', () => {
    // Without this every navigation leaves another listener on a media query that outlives the component.
    const device = stubDevicePreference(false)

    const { unmount } = renderHook(() => usePrefersDark())
    expect(device.listenerCount()).toBe(1)

    unmount()

    expect(device.listenerCount()).toBe(0)
  })
})

describe('what gets put on the page', () => {
  // Following stamps nothing, because the stylesheet's media query is what decides, and an attribute would take that decision away from it.
  it.each([
    ['follow', true, { theme: null, className: 'dark', colorScheme: 'dark' }],
    ['follow', false, { theme: null, className: 'light', colorScheme: 'light' }],
    ['dark', false, { theme: 'dark', className: 'dark', colorScheme: 'dark' }],
    ['light', true, { theme: 'light', className: 'light', colorScheme: 'light' }],
  ] as const)('puts %s on a device asking for dark: %s', (chosen, prefersDark, expected) => {
    applyHowItLooks(chosen, prefersDark)

    expect(theHtml()).toEqual(expected)
  })

  it('takes the mark off again rather than leaving both on', () => {
    applyHowItLooks('dark', false)
    applyHowItLooks('follow', false)

    expect(theHtml()).toEqual({ theme: null, className: 'light', colorScheme: 'light' })
  })
})

describe('remembering the choice', () => {
  it('follows the phone until somebody says otherwise', () => {
    expect(howItLooksNow()).toBe('follow')
  })

  it.each(HOW_IT_LOOKS)('remembers %s across a reload', (chosen) => {
    stubDevicePreference(false)

    const { result, unmount } = renderHook(() => useHowItLooks())
    act(() => {
      result.current.choose(chosen)
    })
    unmount()

    expect(howItLooksNow()).toBe(chosen)
  })

  it('ignores something it has never heard of, rather than looking it up', () => {
    // A stale or hand-edited value must not become a fourth way for the app to look.
    window.localStorage.setItem('howItLooks', 'sepia')

    expect(howItLooksNow()).toBe('follow')
  })

  it('tells the screen the choice was made on, which storage never does', () => {
    stubDevicePreference(false)

    const { result } = renderHook(() => useHowItLooks())
    expect(result.current.chosen).toBe('follow')

    act(() => {
      result.current.choose('dark')
    })

    expect(result.current.chosen).toBe('dark')
    expect(result.current.dark).toBe(true)
  })

  it('goes back to the device the moment following is chosen again', () => {
    const device = stubDevicePreference(true)

    const { result } = renderHook(() => useHowItLooks())
    act(() => {
      result.current.choose('light')
    })
    expect(result.current.dark).toBe(false)

    act(() => {
      result.current.choose('follow')
    })
    expect(result.current.dark).toBe(true)

    act(() => {
      device.change(false)
    })
    expect(result.current.dark).toBe(false)
  })
})

describe('the script that runs before the first paint', () => {
  // It restates what the app does because it runs before the bundle exists; these check the restatement still agrees, in every state.
  it.each([
    ['follow', true],
    ['follow', false],
    ['light', true],
    ['dark', false],
  ] as const)('leaves the page exactly as the app would: %s, device dark: %s', (chosen, prefersDark) => {
    stubDevicePreference(prefersDark)
    window.localStorage.setItem('howItLooks', chosen)

    applyHowItLooks(chosen, prefersDark)
    const afterTheApp = theHtml()

    wipeTheHtml()
    new Function(THEME_INIT_SCRIPT)()

    expect(theHtml()).toEqual(afterTheApp)
  })

  it('actually runs, rather than failing quietly into its own catch', () => {
    // The control: the script swallows anything that throws, which is also how a script doing nothing at all would look.
    stubDevicePreference(true)
    wipeTheHtml()

    new Function(THEME_INIT_SCRIPT)()

    expect(document.documentElement.className).not.toBe('')
  })

  it('survives a phone with storage turned off', () => {
    stubDevicePreference(true)
    vi.stubGlobal('localStorage', undefined)

    expect(howItLooksNow()).toBe('follow')
    expect(() => {
      new Function(THEME_INIT_SCRIPT)()
    }).not.toThrow()
  })
})

describe('the ways it can look', () => {
  it('is the three the screen offers and no more', () => {
    // A fourth would be a way the app can look that no button can reach and no test covers.
    const every: Array<HowItLooks> = ['follow', 'light', 'dark']

    expect([...HOW_IT_LOOKS].sort()).toEqual([...every].sort())
  })
})
