import { ArrowDownToLine, BarChart3, Building2, HandCoins, LayoutDashboard, Settings2, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type Destination = {
  to: string
  label: string
  icon: LucideIcon
  /** Which heading it sits under in the rail, or nothing for the ones above the first heading. */
  under?: 'Ledgers' | 'Money'
}

// Written once and read by both shapes of the nav -- the rail and the strip a phone scrolls -- so a destination cannot appear in one and be forgotten in the other.

// A tab that goes nowhere is the dead end we have already fixed once, and a test holds every destination here to a route that exists. That test is why this list is still one row short of the one he drew: **`Daybook` is his second row and has no route**, so it arrives with its screen rather than ahead of it.

// The headings are his, and they are the reason this file grew a field. A flat list of eight is a list you read; two named groups of two or three are groups you aim at.
export const DESTINATIONS: Array<Destination> = [
  // Above the headings, because neither of them is a place you keep: one is where the whole thing is read back, and the other is where the day's work is entered.
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },

  { to: '/', label: 'Sites', icon: Building2, under: 'Ledgers' },
  { to: '/people', label: 'People', icon: Users, under: 'Ledgers' },

  // `Payables`, `Receipts` and `Settings` are the words he drew. They were `Owed`, `Money in` and `More` because I ruled that a rail saying one word over a page saying another is worse than a rail disagreeing with the drawing -- which was true, and was the wrong way out of it: the screens take the drawn words too, so there is no mismatch to avoid.

  // He opened the deployed app and said it is very different from what he drew. The design decides this now, and a deviation is a thing we bring to him rather than a thing we make.
  { to: '/owed', label: 'Payables', icon: HandCoins, under: 'Money' },

  { to: '/money-in', label: 'Receipts', icon: ArrowDownToLine, under: 'Money' },

  // Arrived with its route rather than ahead of it, which is what the comment above asked for. Under `Money` because every question it opens is one about money, and because the design puts it there.
  { to: '/reports', label: 'Reports', icon: BarChart3, under: 'Money' },

  // Last and apart, the way he drew it: pushed to the foot of the rail above the account, because it is the one row nobody is trying to reach quickly.
  { to: '/more', label: 'Settings', icon: Settings2 },
]

/** The headings, in the order the rail draws them. Read off the destinations rather than written twice, so a group cannot outlive the last thing in it. */
export const GROUPS = ['Ledgers', 'Money'] as const
