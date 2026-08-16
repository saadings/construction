import type { HowItLooks as Look } from '../../lib/theme'
import { useHowItLooks } from '../../lib/theme'
import { Choices } from '../form/Choices'
import { Page } from '../shell/Page'

const LOOKS: Array<{ value: Look; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'follow', label: 'Follow the phone' },
]

/** What the app is called by the person choosing it, for the menu row that leads here. */
export function whatItLooksLike(chosen: Look): string {
  return LOOKS.find((look) => look.value === chosen)?.label ?? 'Follow the phone'
}

export function HowItLooks() {
  const { chosen, choose } = useHowItLooks()

  return (
    <Page title="How it looks">
      <p className="text-muted-foreground max-w-prose text-sm">
        Following the phone is usually right. Change it when you are outside and the screen is hard to read.
      </p>

      {/* The seventh row of choices, and the one that was drawn on shadcn's control directly rather than through this app's. Six were converted and this was not, because the rule that found them refuses `role="radio"` written by hand -- and here Radix writes the role, so nothing had anything to say about it. */}

      {/* What it cost: 36px boxes, eight under the floor a thumb needs, on the screen somebody opens because the screen is already hard to read outside. */}

      {/* Spoken rather than drawn, because the page is titled `How it looks` and a second copy of the question over the boxes is the same words twice. */}
      <Choices
        label="How it looks"
        onlySpoken
        className="max-w-md"
        chosen={chosen}
        choices={LOOKS.map((look) => ({ is: look.value, said: look.label }))}
        onChoose={choose}
      />
    </Page>
  )
}
