// Declared here because the scenario tests import this from a project that has no reason to know about Vite.
/// <reference types="vite/client" />
import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { convexUrl } from './convexUrl'

export const env = createEnv({
  server: {},

  // The prefix client-side variables must carry, enforced in the types and at runtime.
  clientPrefix: 'VITE_',

  // Available on both the client and the server.
  shared: {
    VITE_CONVEX_URL: convexUrl,
  },

  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
    VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  },

  // What holds the variables at runtime.
  runtimeEnv: import.meta.env,

  // Without this, `VAR=` in a .env file reaches Zod as "" and reads as a type error rather than as absent.
  emptyStringAsUndefined: true,
})
