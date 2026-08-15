import { Outlet, createFileRoute } from '@tanstack/react-router'

// More is a menu now, and the places it leads to are screens rather than sections. This holds none of them: it is the join in the address, so `/more/what-for` keeps More marked in the nav while you are on it.
export const Route = createFileRoute('/more')({ component: Outlet })
