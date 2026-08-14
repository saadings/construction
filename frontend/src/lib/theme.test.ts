// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { THEME_INIT_SCRIPT, applyColourScheme, usePrefersDark } from './theme'

// The device is the whole answer, so both quiet failures — nothing listening, and head script disagreeing with hydration — are asserted on the real `<html>`.

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

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.className = ''
  document.documentElement.style.colorScheme = ''
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
  it('marks the page dark, and tells the browser so', () => {
    applyColourScheme(true)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('takes the mark off again rather than leaving both on', () => {
    applyColourScheme(true)
    applyColourScheme(false)

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})

describe('the script that runs before the first paint', () => {
  // It restates applyColourScheme because it runs before the bundle exists; these check the restatement still agrees both ways.
  it.each([true, false])('leaves the page exactly as the app would, device dark: %s', (prefersDark) => {
    stubDevicePreference(prefersDark)

    applyColourScheme(prefersDark)
    const afterApp = {
      className: document.documentElement.className,
      colorScheme: document.documentElement.style.colorScheme,
    }

    document.documentElement.className = ''
    document.documentElement.style.colorScheme = ''

    new Function(THEME_INIT_SCRIPT)()

    expect({
      className: document.documentElement.className,
      colorScheme: document.documentElement.style.colorScheme,
    }).toEqual(afterApp)
  })

  it('actually runs, rather than failing quietly into its own catch', () => {
    // The control: the script swallows anything that throws, which is also how a script doing nothing at all would look.
    stubDevicePreference(true)
    document.documentElement.className = ''

    new Function(THEME_INIT_SCRIPT)()

    expect(document.documentElement.className).not.toBe('')
  })
})
