import { useEffect, useState } from 'react'

// Whether something has been going on longer than it should be, which is the only thing two different silences on this app have in common.

// A send that has not come back and a reading that has not arrived are the same failure from opposite ends: Convex holds a mutation until the connection returns, and holds a subscription open until it can answer. Neither fails, so neither says anything -- a ring turns, or a row of grey bars pulses, for as long as somebody stands there.

/** `true` once `going` has been true for this long without stopping. Reset the moment it stops. */
export function useLongerThan(going: boolean, than: number): boolean {
  const [longer, setLonger] = useState(false)

  useEffect(() => {
    if (!going) {
      setLonger(false)

      return
    }

    const waiting = setTimeout(() => {
      setLonger(true)
    }, than)

    return () => {
      clearTimeout(waiting)
    }
  }, [going, than])

  return longer
}
