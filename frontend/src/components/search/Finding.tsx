import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useEffect } from 'react'

import { Skeleton, WhileWaiting } from '../shell/Skeleton'
import { DESTINATIONS } from '../shell/destinations'
import { Button as OnShadcn } from '../ui/button'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command'

// Nauman: "Good to have this feature as well, use shadcn for this. They have a component." So this is shadcn's `Command`, which is `cmdk`, in the dialog shape it ships.

// What it looks in is what he would look for by name: a house, a person, and the screens themselves. Nothing else in this ledger is a thing you go *to* -- a payment belongs to a day on a house, a bill to the person who raised it, and a trade has no screen of its own, so a row for one would be a row that opens the whole trade list. This app has fixed a nav row leading nowhere once already; it is not worth adding three more to make a list look fuller.

// Read from what is already on the screen rather than from a query of its own. `Sites` and `People` are two lists this ledger is small enough to hold whole -- a partnership building houses in one phase, not a directory -- so there is nothing here a search index would make faster and there is one less door into the data.

/** A house or a person, said the way somebody would ask for it, with where it goes. */
export type Findable = { id: string; name: string; what: string; to: string }

export function whatCanBeFound(
  houses: Array<{ _id: string; name: string }> | undefined | null,
  people: Array<{ _id: string; name: string }> | undefined | null
): Array<Findable> | undefined {
  // `undefined` is carried through rather than collapsed into an empty list, and it is the whole of what this function is for. An empty list is *nothing by that name*; a reading in flight is not an answer at all, and telling somebody their house is not there while it is still arriving is the worst sentence this screen could say.

  // `null` is the ledger refusing this sign-in, which is also not an empty list -- and it comes back through the same door as the rest, so it is answered here rather than left to read as nothing found.
  if (houses === undefined || people === undefined) {
    return undefined
  }

  return [
    ...(houses ?? []).map((house) => ({ id: house._id, name: house.name, what: 'House', to: `/sites/${house._id}` })),
    ...(people ?? []).map((person) => ({
      id: person._id,
      name: person.name,
      what: 'Person',
      to: `/people/${person._id}`,
    })),
  ]
}

// Opened by a control on the header and by the shortcut anybody who uses one expects. The shortcut is a convenience and never the only way in: he is on a phone, where there is no keyboard to press it with, so the control is the way and this is the shorthand.
export function useTheShortcut(open: () => void): void {
  useEffect(() => {
    function pressed(event: KeyboardEvent): void {
      if (event.key !== 'k' || !(event.metaKey || event.ctrlKey)) {
        return
      }

      // Taken from the browser, which uses this for its own search on some platforms and would otherwise open both.
      event.preventDefault()
      open()
    }

    window.addEventListener('keydown', pressed)

    return () => {
      window.removeEventListener('keydown', pressed)
    }
  }, [open])
}

// shadcn's button rather than a `<button>`, which this app has a rule about and which is right here for its own reason: what comes with it is the focus ring and the disabled behaviour, and not one file in this repository writes that tag by hand.

// Not `form/Button`, which is what *sends* a form -- it holds room for a turning ring on both sides of its label, and this is a square on a phone with an icon in it. `Day` and `WayOut` reach for the same one for the same reason.

/** The way in: a control that says what it does, at the size a thumb needs. */
export function WayToFind({ onOpen }: { onOpen: () => void }) {
  return (
    <OnShadcn
      type="button"
      variant="outline"
      onClick={onOpen}
      // Named rather than left to the icon. A magnifying glass is the one icon almost everybody reads, and "almost" is doing work on a screen somebody uses to find a house they are owed money on.
      aria-label="Search for a house or a person"
      className="border-input bg-card text-muted-foreground hover:border-brass hover:text-foreground size-11 justify-center gap-0 px-0 font-normal has-[>svg]:px-0 lg:w-auto lg:justify-start lg:gap-2 lg:px-3 lg:has-[>svg]:px-3"
    >
      <Search className="size-4 shrink-0" aria-hidden />

      {/* The word and the shortcut, as drawn, and `lg` is the drawing's own breakpoint. Below it the control is a square: the row it is in already holds the way into the nav, and a phone has no keyboard to press the shortcut with. */}
      <span className="hidden text-sm lg:inline">Search</span>
      <kbd className="border-border bg-muted ml-6 hidden rounded border px-1.5 py-0.5 font-mono text-[10px] lg:inline">
        ⌘K
      </kbd>
    </OnShadcn>
  )
}

export function Finding({
  found,
  open,
  onOpen,
}: {
  /** Everything with a name, or nothing at all while it is still being read. */
  found: Array<Findable> | undefined
  open: boolean
  onOpen: (open: boolean) => void
}) {
  const navigate = useNavigate()

  function goTo(to: string): void {
    onOpen(false)
    void navigate({ to })
  }

  const houses = (found ?? []).filter((one) => one.what === 'House')
  const people = (found ?? []).filter((one) => one.what === 'Person')

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpen}
      // What the dialog announces itself as. shadcn's defaults are `Command Palette` and `Search for a command to run...`, which are two software terms on a screen that has none.
      title="Find"
      description="A house, a person, or a screen"
      showCloseButton={false}
    >
      <CommandInput placeholder="A house, a person, or a screen" />

      <CommandList>
        {/* Two different sentences, because they are two different facts. An empty list means nothing here is called that; a reading in flight means nobody has looked yet. Collapsing them is how a screen tells somebody their house is gone while it is still arriving. */}

        {/* And two different elements, which is the part a test caught rather than a reading did. `CommandEmpty` draws only when `cmdk` has no matching item at all -- and the screens below always match something, so it fires exactly when somebody has typed a name that matches nothing. That is the right moment for one of these sentences and never for the other: while the names are still arriving the list is not empty, it is short, and a sentence living inside `CommandEmpty` would have gone unsaid every single time. */}
        {found === undefined ? (
          // The shape of what is coming, the way every other screen in this app draws it, rather than a sentence on its own: three rows where three rows will be. `WhileWaiting` also says out loud, after long enough, that nothing has been lost -- which on this screen means the names are still coming rather than absent.
          <WhileWaiting what="Getting the names">
            <div className="flex flex-col gap-2 px-3 py-3">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-5 w-40 max-w-full" />
              ))}
            </div>
          </WhileWaiting>
        ) : (
          <CommandEmpty>Nothing by that name.</CommandEmpty>
        )}

        {houses.length === 0 ? null : (
          <CommandGroup heading="Houses">
            {houses.map((one) => (
              <CommandItem key={one.id} value={one.name} onSelect={() => goTo(one.to)}>
                {one.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {people.length === 0 ? null : (
          <CommandGroup heading="People">
            {people.map((one) => (
              <CommandItem key={one.id} value={one.name} onSelect={() => goTo(one.to)}>
                {one.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* The screens themselves, from the same list the nav draws, so a destination cannot be in one and missing from the other. */}
        <CommandGroup heading="Screens">
          {DESTINATIONS.map((destination) => (
            <CommandItem key={destination.to} value={destination.label} onSelect={() => goTo(destination.to)}>
              <destination.icon className="size-4 shrink-0" aria-hidden />
              {destination.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
