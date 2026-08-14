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
