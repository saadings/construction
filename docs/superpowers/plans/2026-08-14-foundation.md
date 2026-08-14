# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `construction` codebase from the blueprint2 template, cut it completely loose from the organisation it came from, point it at Nauman's own infrastructure, and end with an app he can sign into.

**Architecture:** blueprint2 is copied in as code only. Every identifier belonging to its originating organisation is removed, the CI workflow is rewritten to use public actions, and the Clerk organisation tables are deleted because access here comes from site roles. Convex, Clerk, GitHub and Cloudflare are all Nauman's own accounts.

**Tech Stack:** React 19, TanStack Start (SPA) + TanStack Router, Tailwind v4, shadcn/ui, Convex, Clerk, Cloudflare Pages, GitHub Actions, Vitest + convex-test, ESLint 9, Prettier, Husky, Yarn 4 via corepack.

## Global Constraints

- **Package manager is yarn.** Never npm. Yarn 4 via corepack — Volta is not installed on this machine.
- **Convex CLI is permitted for exactly two jobs:** linking the folder to a deployment, and pushing backend code. Everything else — reading data, environment variables, logs, running functions, inspecting schema — goes through the Convex MCP server.
- **`envList` is never called.** It returns values and would print every secret in the deployment into the transcript. Use `envGet` for a single variable.
- **No identifier belonging to the originating organisation survives anywhere in the tree.** The bar is not that visible naming reads "construction".
- **Never deploy to production from local.** Production deploys happen in CI only.
- **No technical terms in any user-facing string**, including error messages and empty states. Permitted on screen: sites, people, spent, received, owed, trades, cheque, cash, transfer, stage, bill. Never on screen: record, entry, entity, ledger, sync, category, vendor, field, validation, required, error, database, query.
- **Never commit `.env.local`** or any credential. It is already gitignored.
- **Every code change ships with tests.** Vitest, never Jest.
- **Never use `as any`, `@ts-ignore`, or `@ts-expect-error`.** Fix the type.
- **Commit messages follow Conventional Commits.** Never `--no-verify`.

## Inputs required from Nauman

Three things block specific tasks. The plan states where.

| Needed | Where from | Blocks |
|---|---|---|
| `convex` JWT template | dashboard.clerk.com → JWT Templates → new template named exactly `convex` | Task 6 |
| `CONVEX_DEPLOY_KEY` | Convex dashboard → production deployment → Deploy Key | Task 4 |
| `CLERK_WEBHOOK_SECRET` | Clerk dashboard → Webhooks → add endpoint, secret is shown on creation | Task 5 |

## File Structure

Copied from the template and kept as-is:

| Path | Responsibility |
|---|---|
| `convex/users/schema.ts`, `convex/users/actions.ts` | Clerk user mirror, indexed by `externalId` |
| `convex/utils/auth.ts` | `authenticatedQuery` / `authenticatedMutation` with `ctx.identity` |
| `convex/utils/validateRequest.ts` | Svix webhook signature validation |
| `convex/http.ts` | HTTP router, mounts the Clerk webhook |
| `convex/auth.config.ts` | Reads `CLERK_FRONTEND_API_URL`, `applicationID: 'convex'` |
| `frontend/src/routes/__root.tsx` | `ClerkProvider` + `ConvexProviderWithClerk` |
| `frontend/src/router.tsx` | TanStack Router + Convex query client |
| `frontend/src/lib/env.ts` | Typed environment variables |

Deleted:

| Path | Why |
|---|---|
| `convex/organizations/schema.ts`, `convex/organizations/actions.ts` | Access comes from site roles, not Clerk organisations |
| `convex/organizationMembers/schema.ts`, `convex/organizationMembers/actions.ts` | Same |
| `.agents/skills/cloudflare-setup/` | Carries the originating organisation's setup instructions |

Rewritten:

| Path | Why |
|---|---|
| `.github/workflows/deploy.yml` | Depends on a private composite action in another organisation |
| `.claude/settings.json` | Points at another organisation's plugin marketplace |
| `package.json` | Name and repository belong to the template |
| `.env.example` | Template's deployment URLs; also inconsistent with `env.ts` |
| `README.md` | Describes the template, not this project |

---

### Task 1: Bring the template in and strip its origin

**Files:**
- Create: everything from the template except `.git`, `node_modules`, `.env*`
- Modify: `package.json`, `.claude/settings.json`, `README.md`, `scripts/setupCloudflareProject.ts`, `.env.example`
- Delete: `.agents/skills/cloudflare-setup/`

**Interfaces:**
- Consumes: nothing — this is the first task
- Produces: a repository containing the template's code with no identifier from its originating organisation, verified by grep

- [ ] **Step 1: Copy the template in, excluding its git history and any env files**

The template has already been cloned to the scratchpad for inspection. Copy from there, or re-clone. Never copy `.git` — this repository has its own history.

```bash
cd /Users/saadings/Desktop/construction
SP=/private/tmp/claude-501/-Users-saadings-Desktop-construction/bf93ad62-3b79-44b7-a7a5-391019fe28d5/scratchpad
rsync -a \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude '.env.local' \
  "$SP/blueprint2/" .
```

- [ ] **Step 2: Confirm nothing overwrote our own files**

The repository already had `.gitignore` and `docs/`. The template ships its own `.gitignore`.

```bash
git status --short
git diff --stat .gitignore
```

Expected: `docs/` untouched. `.gitignore` modified — the template's version replaced ours.

- [ ] **Step 3: Restore our gitignore rules on top of the template's**

Our rules exclude the source workbooks and every `.env` file. Both must survive. Append to the template's `.gitignore`:

```bash
cat >> .gitignore <<'EOF'

# Source workbooks — excluded deliberately.
# They contain bank account numbers, vendor mobile numbers and named clients'
# financial records. Kept local; not pushed to a third party.
*.xlsx
*.xls
~$*

# Secrets
.env
.env.*
!.env.example
EOF
```

- [ ] **Step 4: Verify the workbooks and env file are still ignored**

```bash
git check-ignore -v .env.local "construction account.xlsx"
```

Expected: both lines match a rule in `.gitignore`. If either is missing, stop and fix before continuing — a later `git add -A` would commit them.

- [ ] **Step 5: Rename the package and drop the template's repository URL**

Edit `package.json`. Change the `name` field and the `repository` field:

```json
{
  "name": "construction",
  "repository": "https://github.com/saadings/construction.git"
}
```

- [ ] **Step 6: Fix the broken cloudflare script path**

`package.json` has `"setup:cloudflare": "tsx scripts/setupCloudflare.ts"` but the file on disk is `scripts/setupCloudflareProject.ts`. This is a bug inherited from the template. Change the script to:

```json
"setup:cloudflare": "tsx scripts/setupCloudflareProject.ts"
```

- [ ] **Step 7: Align the yarn version**

`packageManager` says `yarn@4.13.0` while `volta` pins `yarn@4.12.0`. Volta is not installed on this machine; corepack 0.28.0 is. Remove the `volta` block entirely and keep `packageManager` as the single source of truth:

```bash
python3 - <<'EOF'
import json, collections
p = 'package.json'
d = json.load(open(p), object_pairs_hook=collections.OrderedDict)
d.pop('volta', None)
json.dump(d, open(p, 'w'), indent=2)
open(p, 'a').write('\n')
EOF
```

- [ ] **Step 8: Change the default Cloudflare project name**

In `scripts/setupCloudflareProject.ts` line 29:

```ts
const projectName = getArg('--project-name', 'construction')
```

- [ ] **Step 9: Replace the agent settings file**

`.claude/settings.json` points at another organisation's plugin marketplace and its `ai_toolkit` repository. Replace the whole file with a minimal one:

```json
{
  "enabledPlugins": {}
}
```

- [ ] **Step 10: Delete the inherited Cloudflare setup skill**

```bash
rm -rf .agents/skills/cloudflare-setup
```

- [ ] **Step 11: Replace the README**

The template's README describes the template. Replace it with one that describes this project:

```markdown
# Construction

Site accounts for a house-building partnership: what each site has cost, who
is owed what, money coming in, and client billing.

Replaces six Excel workbooks. Design: `docs/superpowers/specs/2026-08-13-construction-design.md`

## Running it

```bash
corepack enable
yarn install
yarn dev
```

## Checks

```bash
yarn lint:check
yarn format:check
yarn test
```
```

- [ ] **Step 12: Fix the environment example so it matches what the code requires**

`frontend/src/lib/env.ts` requires `VITE_CONVEX_URL`, but `.env.example` sets `CONVEX_URL`. Anyone following the example gets a runtime failure. Replace `.env.example` entirely:

```bash
cat > .env.example <<'EOF'
# Convex — written by `npx convex dev`
CONVEX_DEPLOYMENT=
VITE_CONVEX_URL=

# Clerk
VITE_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_FRONTEND_API_URL=

# Cloudflare — deploys run in CI, these are for local inspection only
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
EOF
```

- [ ] **Step 13: Verify no identifier from the originating organisation survives**

This is the acceptance test for the task.

```bash
grep -rniE 'flatout|blueprint.?2|blueprint-2|fsos' . \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.yarn
```

Expected: **no output at all**, except matches inside `docs/` where the spec discusses the template by name — those are deliberate and describe a decision. If anything else matches, fix it before committing.

- [ ] **Step 14: Install dependencies**

```bash
corepack enable
yarn install
```

Expected: completes without error. Yarn 4 is provisioned by corepack from the `packageManager` field.

- [ ] **Step 15: Commit**

```bash
git add -A
git status --short | grep -E '\.env|xlsx' && echo "STOP — secret or workbook staged" || true
git commit -m "feat: bring in the application codebase

Starts from a template that is already this stack wired together, taken as
code only. Every identifier belonging to the organisation it came from is
removed rather than renamed.

Fixes two bugs inherited from the template: the cloudflare setup script
pointed at a filename that does not exist, and the environment example set
CONVEX_URL while the typed environment loader requires VITE_CONVEX_URL.

Drops the Volta pin, which disagreed with packageManager and is not
installed here; corepack provisions yarn instead."
```

---

### Task 2: Rewrite the deploy workflow

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: the repository from Task 1
- Produces: a workflow that runs entirely on public actions and the repository's own secrets

The template's workflow calls `flatoutsolutions/github-actions/setup@v1` six times. That is a private composite action in another organisation's repository; this repository cannot resolve it, so every job fails at the first step. It has to be replaced with the standard setup steps it was wrapping.

- [ ] **Step 1: Read the existing workflow to learn its shape**

```bash
cat .github/workflows/deploy.yml
```

Note the job names, their triggers, the change-detection logic and the deploy conditions. The structure is worth keeping; only the setup step is being replaced.

- [ ] **Step 2: Write the replacement setup steps**

Everywhere the workflow has:

```yaml
      - uses: flatoutsolutions/github-actions/setup@v1
```

replace it with:

```yaml
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Enable corepack
        run: corepack enable
      - name: Install dependencies
        run: yarn install --immutable
```

If a `actions/checkout@v4` step already precedes it in that job, do not add a second one.

- [ ] **Step 3: Confirm every secret the workflow needs exists**

```bash
grep -oE 'secrets\.[A-Z_]+' .github/workflows/deploy.yml | sort -u
gh secret list --repo saadings/construction
```

The workflow needs `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `CLOUDFLARE_API_TOKEN`, `CONVEX_DEPLOY_KEY`. Two are already set. The rest are added in Tasks 4 and 5 — the workflow is not expected to pass yet.

- [ ] **Step 4: Verify the workflow is valid YAML and references nothing external**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('valid yaml')"
grep -nE '^\s+- uses:' .github/workflows/deploy.yml | grep -viE 'actions/|cloudflare/'
```

Expected: `valid yaml`, and the second command prints nothing — every action used comes from `actions/` or `cloudflare/`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: replace the inherited setup action

The workflow called a private composite action in another organisation's
repository six times, which this repository cannot resolve. Replaced with
the standard checkout, node, corepack and install steps it was wrapping, so
the pipeline depends only on public actions and this repository's own
secrets."
```

---

### Task 3: Remove the organisation tables

**Files:**
- Delete: `convex/organizations/schema.ts`, `convex/organizations/actions.ts`, `convex/organizationMembers/schema.ts`, `convex/organizationMembers/actions.ts`
- Modify: `convex/schema.ts`, `convex/webhooks/clerk.ts`
- Test: `convex/webhooks/clerk.test.ts`

**Interfaces:**
- Consumes: the repository from Task 2
- Produces: a schema containing only `users`; a Clerk webhook handler that responds to the three `user.*` events and ignores everything else

Access in this app comes from site roles — a person is a partner *on a site*, not a member of a company-wide organisation. Keeping both leaves two membership concepts side by side with one doing no work.

- [ ] **Step 1: Write the failing test**

Create `convex/webhooks/clerk.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { handleClerkEvent } from './clerk'

describe('clerk webhook', () => {
  it('ignores organisation events instead of throwing', async () => {
    const calls: string[] = []
    const ctx = {
      runMutation: async (ref: unknown) => {
        calls.push(String(ref))
      },
    }

    await handleClerkEvent(ctx as never, {
      type: 'organization.created',
      data: { id: 'org_1' },
    } as never)

    expect(calls).toEqual([])
  })

  it('still handles user.created', async () => {
    const calls: string[] = []
    const ctx = {
      runMutation: async (ref: unknown) => {
        calls.push(String(ref))
      },
    }

    await handleClerkEvent(ctx as never, {
      type: 'user.created',
      data: {
        id: 'user_1',
        first_name: 'Nauman',
        last_name: 'Saeed',
        email_addresses: [{ id: 'e1', email_address: 'n@example.com' }],
        primary_email_address_id: 'e1',
      },
    } as never)

    expect(calls).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
yarn vitest run convex/webhooks/clerk.test.ts
```

Expected: FAIL. `handleClerkEvent` is not exported yet — the template keeps the switch inline in the HTTP handler.

- [ ] **Step 3: Delete the organisation modules**

```bash
rm -rf convex/organizations convex/organizationMembers
```

- [ ] **Step 4: Remove them from the schema**

Replace `convex/schema.ts` entirely:

```ts
import { defineSchema } from 'convex/server'

import { usersSchema } from './users/schema'

export default defineSchema({
  users: usersSchema,
})
```

- [ ] **Step 5: Extract and trim the webhook handler**

The six `organization*` and `organizationMembership*` cases call mutations that no longer exist, so leaving them would not compile. The switch is also inline inside the HTTP action, which is why it cannot be tested directly — pull it out.

Replace `convex/webhooks/clerk.ts` entirely:

```ts
import type { WebhookEvent } from '@clerk/backend'

import { internal } from '../_generated/api'
import { type ActionCtx, httpAction } from '../_generated/server'
import { validateRequest } from '../utils/validateRequest'

export async function handleClerkEvent(ctx: ActionCtx, event: WebhookEvent) {
  switch (event.type) {
    case 'user.created':
    // intentional fallthrough
    case 'user.updated':
      await ctx.runMutation(internal.users.actions.upsert, {
        data: event.data,
      })
      break

    case 'user.deleted': {
      const clerkUserId = event.data.id!
      await ctx.runMutation(internal.users.actions.remove, {
        clerkUserId,
      })
      break
    }

    default:
      // Organisation events land here. This app grants access through site
      // roles, so there is nothing to mirror.
      console.log('Ignored Clerk webhook event', event.type)
  }
}

export const clerkUsersWebhook = httpAction(async (ctx, request) => {
  const event = await validateRequest(request)
  if (!event) {
    return new Response('Invalid webhook signature', { status: 400 })
  }

  await handleClerkEvent(ctx, event)

  return new Response(null, { status: 200 })
})
```

The user cases keep the template's argument mapping exactly. Only the six organisation cases are gone, and the switch is now callable on its own.

- [ ] **Step 6: Run the tests and watch them pass**

```bash
yarn vitest run convex/webhooks/clerk.test.ts
```

Expected: PASS, both tests.

- [ ] **Step 7: Confirm nothing else references the deleted modules**

```bash
grep -rn "organization" convex frontend --include='*.ts' --include='*.tsx' | grep -v _generated
yarn lint:check
```

Expected: no matches outside generated files, and lint passes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: remove the organisation tables

Access here comes from site roles — a person is a partner on a site, not a
member of a company-wide organisation. Keeping both would leave two
membership concepts side by side with one doing no work.

Extracts the Clerk event switch so it can be tested directly, drops the four
organisation cases, and ignores unrecognised events rather than failing on
them."
```

---

### Task 4: Point Convex at Nauman's deployment

**Files:**
- Modify: `.env.local` (never committed)

**Interfaces:**
- Consumes: the repository from Task 3
- Produces: a linked Convex development deployment with `CLERK_FRONTEND_API_URL` set on it, reachable through the Convex MCP server

**Blocked on:** `CONVEX_DEPLOY_KEY` is needed for Step 6 only. Steps 1–5 can proceed without it.

- [ ] **Step 1: Link the folder to the development deployment**

This is one of the two jobs the Convex CLI is permitted for. It writes `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` into `.env.local`.

```bash
npx convex dev --once
```

When prompted, choose the existing deployment `dev/saad-nauman` (handsome-ferret-39). Do not create a new project.

- [ ] **Step 2: Confirm the link points where we think it does**

Never infer the deployment from what the tables contain. Ask it what it is.

```bash
grep -E '^CONVEX_DEPLOYMENT=|^VITE_CONVEX_URL=' .env.local
```

Expected: `CONVEX_DEPLOYMENT` contains `handsome-ferret-39`, and `VITE_CONVEX_URL` is `https://handsome-ferret-39.convex.cloud`. If either names a different deployment, stop — everything after this would be written to the wrong place.

- [ ] **Step 3: Confirm the MCP server can now reach it**

Call `mcp__convex__status` with `projectDir` set to `/Users/saadings/Desktop/construction`.

Expected: a deployment selector is returned, rather than the earlier `No CONVEX_DEPLOYMENT set` error.

- [ ] **Step 4: Set the Clerk issuer on the deployment**

`convex/auth.config.ts` reads `CLERK_FRONTEND_API_URL` from the deployment's own environment, not from `.env.local`. Set it through the MCP server — `mcp__convex__envSet` — with the deployment selector from Step 3:

```
name:  CLERK_FRONTEND_API_URL
value: https://secure-goose-32.clerk.accounts.dev
```

Do not use `envList` to check the result. It returns values and would print every secret in the deployment.

- [ ] **Step 5: Read back just that one variable**

Call `mcp__convex__envGet` with `name: CLERK_FRONTEND_API_URL`.

Expected: `https://secure-goose-32.clerk.accounts.dev`.

- [ ] **Step 6: Add the production deploy key to CI**

Requires `CONVEX_DEPLOY_KEY` from Nauman — Convex dashboard, production deployment, Deploy Key.

Take it from a prompt rather than pasting it into the command, so it never enters argv or shell history:

```bash
read -rs CONVEX_DEPLOY_KEY_VALUE
printf '%s' "$CONVEX_DEPLOY_KEY_VALUE" | gh secret set CONVEX_DEPLOY_KEY --repo saadings/construction
unset CONVEX_DEPLOY_KEY_VALUE
gh secret list --repo saadings/construction
```

Expected: `CONVEX_DEPLOY_KEY` appears in the list. This is a **production** key — it belongs in CI only and must not be written to `.env.local`.

- [ ] **Step 7: Confirm no credential reached git**

```bash
git status --porcelain
git log -p --all | grep -cE 'cfat_|sk_test_|pk_test_|CONVEX_DEPLOY' || echo "0 — clean"
```

Expected: `.env.local` does not appear in `git status`, and the history scan returns zero.

---

### Task 5: Wire the Clerk webhook

**Files:**
- Modify: `.env.local`, Clerk dashboard (manual)

**Interfaces:**
- Consumes: the linked deployment from Task 4
- Produces: Clerk user events reaching Convex and creating rows in `users`

**Blocked on:** `CLERK_WEBHOOK_SECRET`, which Clerk shows only when the endpoint is created.

- [ ] **Step 1: Confirm the webhook URL**

`convex/http.ts` routes `POST /webhooks/clerk` to the handler, and Convex serves its HTTP router from the `.site` domain rather than `.cloud`. So the endpoint is:

```
https://handsome-ferret-39.convex.site/webhooks/clerk
```

Confirm the path has not been changed:

```bash
grep -n "path:" convex/http.ts
```

Expected: `path: '/webhooks/clerk'`.

- [ ] **Step 2: Nauman adds the endpoint in Clerk**

dashboard.clerk.com → Webhooks → Add Endpoint. URL is the one from Step 1. Subscribe to `user.created`, `user.updated` and `user.deleted` only — organisation events are ignored by the handler and subscribing to them would send traffic for nothing. Clerk shows the signing secret once, on creation.

- [ ] **Step 3: Set the signing secret on the Convex deployment**

Through `mcp__convex__envSet`:

```
name:  CLERK_WEBHOOK_SECRET
value: <the whsec_... value from Step 2>
```

- [ ] **Step 4: Add it, and the Clerk keys, to CI**

The workflow needs three Clerk secrets. Two are already in `.env.local`; the signing secret comes from Step 2. Read each from a prompt so none enters shell history:

```bash
read -rs CLERK_WEBHOOK_SECRET_VALUE
printf '%s' "$CLERK_WEBHOOK_SECRET_VALUE" | gh secret set CLERK_WEBHOOK_SECRET --repo saadings/construction
unset CLERK_WEBHOOK_SECRET_VALUE

grep -E '^VITE_CLERK_PUBLISHABLE_KEY=' .env.local | cut -d= -f2- \
  | tr -d '\n' | gh secret set CLERK_PUBLISHABLE_KEY --repo saadings/construction
grep -E '^CLERK_SECRET_KEY=' .env.local | cut -d= -f2- \
  | tr -d '\n' | gh secret set CLERK_SECRET_KEY --repo saadings/construction

gh secret list --repo saadings/construction
```

Expected: five secrets listed — `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` — plus `CONVEX_DEPLOY_KEY` from Task 4.

Note the name difference: the workflow reads `CLERK_PUBLISHABLE_KEY` while the app reads `VITE_CLERK_PUBLISHABLE_KEY`. The `VITE_` prefix is what exposes it to the browser bundle; the CI secret has no prefix and the workflow adds it. Do not "fix" this by renaming one of them.

- [ ] **Step 5: Verify a real event lands**

Have Nauman sign up in the running app (Task 6), then check the table through the MCP server rather than the dashboard:

Call `mcp__convex__tables` with the deployment selector.

Expected: a `users` table with one row whose `externalId` starts with `user_`.

If the table is empty, do not conclude the webhook is broken until you have confirmed the instrument can see anything at all — an empty result and a misconfigured read look identical. Check Clerk's webhook delivery log for a non-2xx response first.

---

### Task 6: Sign-in working end to end

**Files:**
- Modify: `frontend/src/routes/index.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–5
- Produces: a running app with visible sign-in, sign-up and signed-in controls

**Blocked on:** the `convex` JWT template must exist in Clerk. Without it, sign-in appears to work and every Convex call silently returns nothing.

- [ ] **Step 1: Confirm the JWT template exists**

dashboard.clerk.com → JWT Templates. There must be a template named exactly `convex`. `convex/auth.config.ts` sets `applicationID: 'convex'`, which is checked against the token's `aud` claim, so the name must match character for character.

This is not optional and there is no code-level workaround.

- [ ] **Step 2: Add the auth controls to the landing route**

Edit `frontend/src/routes/index.tsx`. The `ClerkProvider` is already in place in `__root.tsx`, so only the controls are needed:

```tsx
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/tanstack-react-start'

function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Construction</h1>
      <p className="text-muted-foreground">
        Sites, spending and what everyone is owed.
      </p>

      <SignedOut>
        <div className="flex gap-3">
          <SignInButton mode="modal" />
          <SignUpButton mode="modal" />
        </div>
      </SignedOut>

      <SignedIn>
        <UserButton />
      </SignedIn>
    </main>
  )
}
```

Keep the route's existing export shape — only the component body changes.

- [ ] **Step 3: Start the app**

```bash
yarn dev
```

- [ ] **Step 4: Sign up as the first user**

In the browser, sign up. Expected: the sign-up modal completes and the user button appears.

- [ ] **Step 5: Prove the token actually reaches Convex**

Sign-in succeeding in the browser does not prove Convex accepts the token — that is exactly what a missing JWT template looks like. Confirm the round trip: the `users` table gains a row (Task 5, Step 5). If it does not, the fault is the JWT template or the webhook, not the frontend.

- [ ] **Step 6: Run every check**

```bash
yarn lint:check
yarn format:check
yarn test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add sign-in to the landing screen

Sign in, sign up and the signed-in user control, using the provider already
wired in the root route."
```

- [ ] **Step 8: Push and watch CI**

```bash
git push origin main
gh run watch --repo saadings/construction
```

Expected: green. If the deploy job fails on a missing secret, that secret is one of the two listed as blocked inputs.

---

## What this plan does not cover

The ledger itself. Money and date primitives, the shared Zod module, the schema for sites, trades, people, site roles and payments, the access-check helper built on `authenticatedQuery`, and the day-sheet entry flow are the second plan, written once this one is green.

That split is deliberate: this plan carries the unknowns — a rewritten CI pipeline and two credentials that do not exist yet — and the ledger work should not wait behind them.
