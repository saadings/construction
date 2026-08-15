import { Building2, HandCoins, LayoutDashboard, Settings2, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type Destination = {
  to: string
  label: string
  icon: LucideIcon
}

// Written once and read by both shapes of the nav -- the column and the sheet -- so a destination cannot appear in one and be forgotten in the other.

// A tab that goes nowhere is the dead end we have already fixed once, and a test holds every destination here to a route that exists.

// A phone reads this list in a sheet now rather than a bar along the bottom, so there is no four-place limit and nothing quietly overflows. What belongs here is what is not about one house: money coming in is reached from a house, the same way a day of spending is.
export const DESTINATIONS: Array<Destination> = [
  // First, because it is the only one that answers "where are we" without picking a house first. The app still opens on the houses: that is where the work starts, and this is where it is read back.
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/', label: 'Sites', icon: Building2 },
  { to: '/people', label: 'People', icon: Users },
  { to: '/owed', label: 'Owed', icon: HandCoins },
  { to: '/more', label: 'More', icon: Settings2 },
]
