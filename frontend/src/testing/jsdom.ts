// What jsdom does not implement and shadcn's components ask for. Given to every jsdom test rather than to the one that noticed, because the next component to ask will be on somebody else's screen.

// `matchMedia` is the one that bites first: `useIsMobile` calls it on mount, so a shell wrapped in `SidebarProvider` renders nothing at all without it -- not a wrong layout, no layout, and the error arrives inside a React error boundary where it reads as the test's own fault.

// It answers `max-width` against `window.innerWidth` rather than answering false to everything, so a test can say what width it is at by setting that. jsdom applies no CSS either way -- a class is still an inert string here -- but a component that *branches* on width in JavaScript can be asked about both branches, and shadcn's sidebar is one: below 768 it renders a sheet and above it a column.

// Guarded, because this is asked of every test under `frontend/` and several say `@vitest-environment node`: their subject is the source rather than a screen. Reaching for a `window` that is not there turned seven suites into load failures, which report as `Tests 709 passed` under a `Test Files 7 failed` that is easy to read past.
if (typeof window !== 'undefined') {
  // Built on `EventTarget` rather than an object literal shaped like one: listening, removing and dispatching are then the real things, rather than four stubs standing in for a type that cannot be satisfied by hand without a cast.
  class Query extends EventTarget implements MediaQueryList {
    readonly media: string
    onchange: MediaQueryList['onchange'] = null

    private readonly upTo: number | null

    constructor(media: string) {
      super()
      this.media = media

      const found = /max-width:\s*(\d+)px/.exec(media)
      this.upTo = found === null ? null : Number(found[1])
    }

    get matches(): boolean {
      return this.upTo === null ? false : window.innerWidth <= this.upTo
    }

    // The two older names, which some libraries still call and the type still carries.
    addListener(listener: (this: MediaQueryList, event: MediaQueryListEvent) => void) {
      this.addEventListener('change', listener as EventListener)
    }

    removeListener(listener: (this: MediaQueryList, event: MediaQueryListEvent) => void) {
      this.removeEventListener('change', listener as EventListener)
    }
  }

  const asked = new Set<Query>()

  // Assigned rather than defaulted: the type says jsdom has this and jsdom does not, so `??=` reads as dead code to the linter and is the only line that runs.
  window.matchMedia = (media: string) => {
    const query = new Query(media)
    asked.add(query)

    return query
  }

  // The other one jsdom leaves out, and it leaves it out entirely rather than stubbing it: the type says every element has it, the linter agrees, and a call to it throws here. A picker that opens a question underneath itself scrolls that question into view, because on a phone it opens under the keyboard.

  // Assigned rather than guarded at the call site for the same reason as `matchMedia` above: a `?.` there is dead code to the linter, which is right about the browser and wrong about this room.
  Element.prototype.scrollIntoView = function scrollIntoView() {
    // Nothing to do: jsdom has no layout, so there is no viewport to bring anything into. What matters is that calling it is not an error.
  }

  // The third thing jsdom leaves out, and the one a screen keeping a half-typed sitting needs. Given here rather than mocked per test: what is being tested is that the sitting survives, and a test that hands the screen its own fake store proves the fake works.

  // A `Map` behind the real shape, because `Storage` is a real interface and a hand-made object literal satisfying it needs a cast. Values are strings, as they are in a browser: anything else would let a test pass on something the real store cannot hold.
  if (typeof window.localStorage === 'undefined') {
    const held = new Map<string, string>()

    const store: Storage = {
      get length() {
        return held.size
      },
      key: (at: number) => [...held.keys()][at] ?? null,
      getItem: (name: string) => held.get(name) ?? null,
      setItem: (name: string, value: string) => {
        held.set(name, String(value))
      },
      removeItem: (name: string) => {
        held.delete(name)
      },
      clear: () => {
        held.clear()
      },
    }

    Object.defineProperty(window, 'localStorage', { value: store, configurable: true })
  }

  // The fourth, and it arrived with `cmdk`: a command list watches its own height so it can size the popup around it. jsdom has no `ResizeObserver` at all, and the throw lands inside React's render, so the dialog draws **nothing** and every query against it fails as "unable to find the text" -- which reads as the component being wrong rather than the room being empty.

  // Nothing is observed, because there is no layout here to observe. What matters is that constructing one and calling it is not an error: a component that measures itself must be *drawable* in a room with no measurements, and where its size actually matters is `yarn columns`, in a browser.
  if (typeof window.ResizeObserver === 'undefined') {
    window.ResizeObserver = class implements ResizeObserver {
      observe() {
        // No layout, so nothing to report.
      }

      unobserve() {
        // The same, and it must exist: a component that observes on mount disconnects on unmount.
      }

      disconnect() {
        // The same again.
      }
    }
  }

  // What a resize is, to anything watching. A test sets `window.innerWidth` and dispatches one; nothing here polls, so without this a width set after mount is a width nobody hears about.
  window.addEventListener('resize', () => {
    for (const query of asked) {
      query.dispatchEvent(new Event('change'))
    }
  })
}
