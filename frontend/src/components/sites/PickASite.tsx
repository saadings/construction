import { Pick } from '../form/Pick'
import type { Choice } from '../form/Pick'

// Which house this is about, chosen on the screen rather than carried in the address.

// Its own component for one reason: his drawing labels it `Site` on the daybook and `Which site it is for` on the receipt form, and those are the same question asked twice. Two screens writing the label themselves is how they come to disagree, and the app has already had that exact defect between a rail and the page it opened.

// A combobox rather than the `<select>` he drew, and that is not a preference. Every list in this app was a `<select>` or a `<datalist>` until Nauman sent a screenshot of the browser's own popup drawn in Chrome's mauve over the error text underneath it -- there is no CSS that reaches it. `Pick` is the one way anything is chosen here, so this is one more caller of it rather than an exception to it.
export type ASite = { _id: string; name: string }

export function PickASite({
  sites,
  chosen,
  onPick,
}: {
  sites: Array<ASite>
  chosen: string
  /** Never handed nothing. A day of payments has to be against a house, so clearing the box leaves the house as it was rather than emptying the screen underneath. */
  onPick: (siteId: string) => void
}) {
  const choices: Array<Choice> = sites.map((site) => ({ _id: site._id, name: site.name }))

  return (
    <Pick
      label="Site"
      placeholder="Pick a house"
      chosen={choices.find((choice) => choice._id === chosen) ?? null}
      choices={choices}
      onPick={(picked) => {
        if (picked !== null) onPick(picked._id)
      }}
    />
  )
}
