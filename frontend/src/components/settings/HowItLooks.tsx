import type { HowItLooks as Look } from '../../lib/theme'
import { useHowItLooks } from '../../lib/theme'
import { Page } from '../shell/Page'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'

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

      <ToggleGroup
        type="single"
        value={chosen}
        // A segmented control hands back an empty string when the pressed one is pressed again, and that is not a fourth way for the app to look.
        onValueChange={(picked) => {
          const known = LOOKS.find((look) => look.value === picked)
          if (known !== undefined) {
            choose(known.value)
          }
        }}
        variant="outline"
        aria-label="How it looks"
        className="w-full max-w-md"
      >
        {LOOKS.map((look) => (
          <ToggleGroupItem key={look.value} value={look.value} className="flex-1">
            {look.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Page>
  )
}
