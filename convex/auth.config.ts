import { AuthConfig } from 'convex/server'

export default {
  providers: [
    {
      // CLERK_FRONTEND_API_URL is read from the environment of the Convex
      // deployment this file runs on, not from `.env.local`. CI writes it in
      // the sync-secrets job; a deployment set up by hand needs it set there
      // too, under exactly this name.
      //
      // Leave it unset and there is no issuer to check tokens against, so
      // `getUserIdentity()` returns null and every check denies — while
      // signing in through the browser still looks completely normal. The `!`
      // states an expectation that nothing here enforces, which is why
      // scenarios/environment-contract.scenario.test.ts pins the unset case.
      domain: process.env.CLERK_FRONTEND_API_URL!,
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig
