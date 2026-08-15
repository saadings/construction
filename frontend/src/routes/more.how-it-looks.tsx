import { createFileRoute } from '@tanstack/react-router'

import { HowItLooks } from '../components/settings/HowItLooks'

export const Route = createFileRoute('/more/how-it-looks')({ component: HowItLooks })
