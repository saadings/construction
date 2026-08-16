import { useCallback, useRef, useState } from 'react'

// A row added while a form is open is a row the list it was picked from does not have yet.

// The screens here draw their choices from a Convex query and check every picked id against that list -- deliberately, so an id can only ever come from something drawn. A trade added mid-sitting is the one legitimate id that is not in that list at the moment it is chosen, and without this the field goes blank the instant it is added: the add worked, the pick was silently dropped, and the next thing he does is type the name again.

// Held in a ref as well as in state, which is the half a first version got wrong and its test caught. Adding and picking happen in one go, so the check runs inside a handler closed over the render before the new row existed -- state has not arrived, the id is not in the list, and the guard drops the pick it was there to protect.
export function useWhatWasAdded<TRow extends { _id: string }>(
  rows: Array<TRow>
): {
  /** The rows as read, plus anything this screen created since it opened. */
  everything: Array<TRow>
  remember: (row: TRow) => void
  /** The same check every picked id goes through, widened by exactly what this screen created itself. */
  pickedFromThese: (id: string) => TRow['_id'] | ''
} {
  const [added, setAdded] = useState<Array<TRow>>([])
  const soFar = useRef<Array<TRow>>([])

  const remember = useCallback((row: TRow) => {
    soFar.current = [...soFar.current, row]
    setAdded(soFar.current)
  }, [])

  const pickedFromThese = useCallback(
    (id: string): TRow['_id'] | '' =>
      rows.some((row) => row._id === id) || soFar.current.some((row) => row._id === id) ? id : '',
    [rows]
  )

  // Filtered rather than concatenated, because the query does catch up: once the list carries the new row, keeping a second copy of it would draw the same trade twice.
  return {
    everything: [...rows, ...added.filter((one) => !rows.some((row) => row._id === one._id))],
    remember,
    pickedFromThese,
  }
}
