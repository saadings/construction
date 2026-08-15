import { createFileRoute } from '@tanstack/react-router'

import { YourSignIn } from '../components/settings/YourSignIn'

export const Route = createFileRoute('/more/your-sign-in')({ component: YourSignIn })
