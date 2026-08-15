import { Building2, Settings2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type Destination = {
  to: string
  label: string
  icon: LucideIcon
  // Whether it belongs in the bar along the bottom of a phone, where there is room for four and no more.
  onThePhone: boolean
}

// Written once and read by all three shapes of the nav, so a destination cannot appear in one and be forgotten in another.

// People, Owed and Coming in join this list as their screens land. A tab that goes nowhere is the dead end we have already fixed once, and a test holds every destination here to a route that exists.
export const DESTINATIONS: Array<Destination> = [
  { to: '/', label: 'Sites', icon: Building2, onThePhone: true },
  { to: '/more', label: 'More', icon: Settings2, onThePhone: true },
]

// The bottom bar takes four. Anything past that is reached from More, which is why More is always the last of them.
export const ON_THE_PHONE = DESTINATIONS.filter((destination) => destination.onThePhone).slice(0, 4)
