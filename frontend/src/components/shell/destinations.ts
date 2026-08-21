import {
  ArrowDownToLine,
  BarChart3,
  Building2,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  Settings2,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type Destination = {
  to: string
  label: string
  icon: LucideIcon
  /** Which heading it sits under in the rail, or nothing for the ones outside the headings entirely. */
  under?: 'Ledgers' | 'Money'
  // Pushed to the bottom of the rail rather than sitting above the first heading with the others. Said here rather than counted in the nav, which sliced the ungrouped rows at a fixed index -- so `Daybook` arriving above the headings silently moved `Settings` up to the top with it. A list that knows its own shape cannot be miscounted by the thing drawing it.
  atTheFoot?: true
}

// Written once and read by both shapes of the nav -- the rail and the strip a phone scrolls -- so a destination cannot appear in one and be forgotten in the other.

// A tab that goes nowhere is the dead end we have already fixed once, and a test holds every destination here to a route that exists. That rule is why this list was one row short of the one he drew for as long as it was: `Daybook` is his second row, it had no route, and it has arrived with its screen rather than ahead of it.

// The headings are his, and they are the reason this file grew a field. A flat list of eight is a list you read; two named groups of two or three are groups you aim at.

// The addresses stay as they are -- `/owed`, `/receipts`, `/more`. What he opens and what he reads is the label; a path is not drawn anywhere in his design, and moving three of them would put every link, trail and picture through a rename that changes nothing he can see.
export const DESTINATIONS: Array<Destination> = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },

  // His second row, and the reason these two sit above the headings: one is where the whole thing is read back and this is where the day's work goes in. Neither is a ledger you keep, which is what the headings below are for.

  // A clipboard rather than a book, because a clipboard with lines on it is the icon he drew.
  { to: '/daybook', label: 'Daybook', icon: ClipboardList },

  { to: '/', label: 'Sites', icon: Building2, under: 'Ledgers' },
  { to: '/people', label: 'People', icon: Users, under: 'Ledgers' },

  // `Payables`, `Receipts` and `Settings` are the words he drew. They were `Owed`, `Money in` and `More` because I ruled that a rail saying one word over a page saying another is worse than a rail disagreeing with the drawing -- which was true, and was the wrong way out of it: the screens take the drawn words too, so there is no mismatch to avoid.

  // He opened the deployed app and said it is very different from what he drew. The design decides this now, and a deviation is a thing we bring to him rather than a thing we make.
  { to: '/owed', label: 'Payables', icon: HandCoins, under: 'Money' },

  { to: '/receipts', label: 'Receipts', icon: ArrowDownToLine, under: 'Money' },

  // Arrived with its route rather than ahead of it, which is what the comment above asked for. Under `Money` because every question it opens is one about money, and because the design puts it there.
  { to: '/reports', label: 'Reports', icon: BarChart3, under: 'Money' },

  // Last and apart, the way he drew it: pushed to the foot of the rail above the account, because it is the one row nobody is trying to reach quickly.
  { to: '/more', label: 'Settings', icon: Settings2, atTheFoot: true },
]

/** The headings, in the order the rail draws them. Read off the destinations rather than written twice, so a group cannot outlive the last thing in it. */
export const GROUPS = ['Ledgers', 'Money'] as const
