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

  // What a resize is, to anything watching. A test sets `window.innerWidth` and dispatches one; nothing here polls, so without this a width set after mount is a width nobody hears about.
  window.addEventListener('resize', () => {
    for (const query of asked) {
      query.dispatchEvent(new Event('change'))
    }
  })
}
