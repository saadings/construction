# Construction

Site accounts for a house-building partnership: what each site has cost, who
is owed what, money coming in, and client billing.

Replaces six Excel workbooks. Design: `docs/superpowers/specs/2026-08-13-construction-design.md`

## Running it

```bash
corepack enable
yarn install
cp .env.example .env.local   # then fill it in
npx convex dev --once        # writes CONVEX_DEPLOYMENT and VITE_CONVEX_URL for you
yarn dev
```

The Convex step is not optional and it is not only for the backend. Both
`yarn dev` and `yarn build` read `VITE_CONVEX_URL`, and without it they stop
with a stack trace about the environment rather than anything that names the
missing step. It also writes `convex/_generated`, which `yarn typecheck` needs
in order to check the backend at all.

Two variables go on the Convex deployment rather than in `.env.local`, because
that is where the backend reads them from — `npx convex env set <NAME> <value>`,
after the step above has linked one:

- `CLERK_FRONTEND_API_URL` — the Clerk instance whose tokens this deployment
  accepts. Without it every signed-in person is refused by the backend while
  signing in still looks like it worked.
- `CLERK_WEBHOOK_SECRET` — the signing secret shown when the Clerk webhook
  endpoint was created. Without it the webhook answers 500, so the `users`
  table stays empty behind a sign-up the browser reported as finished.

## Checks

```bash
yarn lint:check
yarn format:check
yarn typecheck
yarn test
yarn test:scenario
yarn build
```

The same set runs on every commit through the pre-commit hook, and in CI.
