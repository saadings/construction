import { createFileRoute } from '@tanstack/react-router'

import { Form, Page } from '../components/shell/Page'
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group'
import type { HowItLooks } from '../lib/theme'
import { useHowItLooks } from '../lib/theme'

export const Route = createFileRoute('/more')({ component: More })

const LOOKS: Array<{ value: HowItLooks; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'follow', label: 'Follow the phone' },
]

function More() {
  const { chosen, choose } = useHowItLooks()

  return (
    <Page title="More">
      <Form>
        <section className="flex flex-col gap-3">
          <h2 className="text-foreground text-base font-medium">How it looks</h2>
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
        </section>
      </Form>
    </Page>
  )
}
