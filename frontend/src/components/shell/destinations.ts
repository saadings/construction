import { Building2, HandCoins, LayoutDashboard, Settings2, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type Destination = {
  to: string
  label: string
  icon: LucideIcon
  /** Which heading it sits under in the rail, or nothing for the ones above the first heading. */
  under?: 'Ledgers' | 'Money'
}

// Written once and read by both shapes of the nav -- the rail and the strip a phone scrolls -- so a destination cannot appear in one and be forgotten in the other.

// A tab that goes nowhere is the dead end we have already fixed once, and a test holds every destination here to a route that exists. That test is why this list is shorter than the one he drew: `Daybook`, `Receipts` and `Reports` are in his design as top-level rows and have no route yet, so they arrive with their routes rather than ahead of them.

// The headings are his, and they are the reason this file grew a field. A flat list of eight is a list you read; two named groups of two or three are groups you aim at.
export const DESTINATIONS: Array<Destination> = [
  // Above the headings, because neither of them is a place you keep: one is where the whole thing is read back, and the other is where the day's work is entered.
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },

  { to: '/', label: 'Sites', icon: Building2, under: 'Ledgers' },
  { to: '/people', label: 'People', icon: Users, under: 'Ledgers' },

  // `Owed` rather than the design's `Payables` on purpose. The screen it opens is titled `Owed` and is in the other half of this rename; a rail saying one word over a page saying another is the mismatch a picture caught on `coming-in` an hour ago, and it is not worth creating a second one to be an hour early.
  { to: '/owed', label: 'Owed', icon: HandCoins, under: 'Money' },

  // Last and apart, the way he drew it: pushed to the foot of the rail above the sign-out, because it is the one row nobody is trying to reach quickly. `More` rather than his `Settings` for the same reason as the row above.
  { to: '/more', label: 'More', icon: Settings2 },
]

/** The headings, in the order the rail draws them. Read off the destinations rather than written twice, so a group cannot outlive the last thing in it. */
export const GROUPS = ['Ledgers', 'Money'] as const
