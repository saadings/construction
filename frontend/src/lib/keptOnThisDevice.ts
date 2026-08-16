// A sitting is eight payments typed standing on a site, and until now it lived in React state alone: the phone locks, iOS discards the tab, and the whole thing is gone with nothing having warned him. The ledger silently losing the thing it exists to record.

// Kept on the device rather than sent early, because a half-typed payment is not a payment and the server should never hold one. What this is for is surviving the tab, not surviving the phone.

// Everything about this is deliberately narrow. It holds money-shaped answers -- what was paid, to whom -- on a device Nauman shares, so it is written under one key, it is cleared the moment the sitting goes in, and nothing else in this app may use it to keep anything.

// Three ways there is nowhere to keep anything, and this app must work in all of them: a locked-down device throws on the property itself, private browsing throws on the write, and a runtime can simply not have one -- which is not hypothetical, it is what the tests run in.

/** What is holding it, or nothing at all. */
function theStore(): Storage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the type says every browser has one and the runtime disagrees
    return window.localStorage ?? null
  } catch {
    return null
  }
}

/** What was kept under this name, or `null` for nothing kept and for anything that cannot be read back as what was written. */
export function whatWasKept<TKept>(under: string): TKept | null {
  const store = theStore()
  if (store === null) return null

  try {
    const said = store.getItem(under)

    return said === null ? null : (JSON.parse(said) as TKept)
  } catch {
    // Left behind by an older shape of this app, or half-written when the tab died. Unreadable is the same as nothing, and it must never be the reason a screen throws on open.
    return null
  }
}

export function keepOnThisDevice(under: string, what: unknown): void {
  const store = theStore()
  if (store === null) return

  try {
    store.setItem(under, JSON.stringify(what))
  } catch {
    // A full quota is not worth a refusal on a screen he is typing into. The sitting stays in memory, exactly as it was before any of this.
  }
}

export function forgetOnThisDevice(under: string): void {
  const store = theStore()
  if (store === null) return

  try {
    store.removeItem(under)
  } catch {
    // Nothing to be done and nothing worth saying: the next write puts something readable back over it.
  }
}
