import { AuthConfig } from 'convex/server'

export default {
  providers: [
    {
      // Read from the Convex deployment's own environment, never `.env.local`; unset, every access check denies silently.
      domain: process.env.CLERK_FRONTEND_API_URL!,
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig
