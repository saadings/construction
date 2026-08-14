# Construction — Design

**Date:** 2026-08-13
**Status:** Awaiting approval
**Owner:** Nauman Saeed (sole stakeholder and primary user)

## Purpose

Replace six Excel workbooks with a mobile-first web app for a house-building
partnership operating in DHA Lahore.

The problem is not any single missing feature. It is that the workbooks have no
structure and cannot be maintained: 66 header labels for roughly 45 real trades,
totals that reference fixed row ranges and silently exclude anything typed below
them, five undocumented constants hand-typed inside summary formulas, a live
`#REF!`, and three copies of the same ledger that no longer agree with each
other. The app exists to give this business a shape its money can live in.

Full analysis of the source workbooks:
https://claude.ai/code/artifact/15408f18-a188-499e-83a2-61656ef96d83

## Decisions taken

| Question | Decision |
|---|---|
| Historical data | None migrated. The app starts empty. Excel becomes the archive, including for the site currently under construction. |
| Who signs in | Nauman and his business partners. No clients, no site staff, no office account. |
| Partner rights | Full equal access on any site they are on — add, edit, remove. |
| Connectivity | Light offline. A connection is expected; nothing typed is ever lost when it drops. |
| First version scope | Spending, vendors and what they are owed, money coming in, and client contracts with billing. All four. |
| Organising principle | Sites first. Sites are the structure the business already thinks in. |
| Project setup | Personal project. Convex, Clerk, Cloudflare. No company tooling, no company branding. |
| Codebase base | The `blueprint2` template, taken as code only. Nothing wired to the organisation it came from — every account and deployment is Nauman's. |
| Convex deployment | Supplied by Nauman. Not created by this project. |

## Non-goals for the first version

Photo attachments, Excel export, notifications, an Urdu interface, client or
site-staff logins, and the ten years of historical data. Each can be added onto
this shape later. None is needed for the app to earn its place on day one.

## Language rules

No technical term appears anywhere a user can see it, including in error
messages and empty states.

**Used on screen:** sites, people, spent, received, owed, trades, cheque, cash,
transfer, stage, bill.

**Never on screen:** record, entry, entity, ledger, sync, category, vendor,
field, validation, required, error, database, query.

Amounts are written the way the workbooks write them — `4,974,980`, comma
grouped, no decimals unless the underlying figure has them.

## Screens

Three tabs and one add button. Nothing else in the navigation.

**Sites · People · More**, with a floating **+**.

### Sites (home)

A list. Each row shows the site name, its stage, and one number — spent so far
for an own build, still to collect for a client job.

### Inside a site

Name, then two figures side by side (out and in), then four sections:

- **Where the money went** — trades with totals, tapping through to the payments
- **People on this site** — who is on which trade, and for each of them agreed,
  billed, paid, and the balance still standing
- **Money coming in** — partner money, client payments, sale
- **Billing** — client sites only. Stages, billed, received, due.

### Adding a payment

A day-sheet flow, not a form repeated eight times. Site and date are chosen
once, then trade → who → how much → how paid → note, with "add another" keeping
the site and date. A running total for the sitting stays at the top.

This matches how the work actually happens: one cheque run on a Tuesday
touching eight trades.

### Recording what someone is owed

The **+** button offers two things, not one: money going out, and a bill coming
in. A bill is the shorter form — who, which site, which trade, how much, their
bill number if there is one.

Bills are entirely optional. Most spending will never have one recorded against
it, and the app never asks for one before letting a payment through. They exist
for the people whose outstanding actually needs watching — the tile supplier
carrying 763,701, the kitchen fitter carrying 770,000 — not for every bag of
cement.

A bill can also be raised from inside a person's account, which is where the
question "what does he still have coming?" usually gets asked.

### People

Everyone you deal with, across all sites. Tapping one opens **their account** —
a statement in date order showing everything they have billed, everything they
have been paid, and the balance after each line, exactly the way the
`MR FARAN ACCOUNT` sheet reads today.

The account spans every site. A steel supplier delivering to two sites has one
account with one balance, because that is how the debt actually works — not two
half-balances that have to be added up in someone's head.

The balance runs both ways. A positive balance is money owed to them; a negative
one means they are holding an advance. Advances are common enough in the
workbooks (`ADV`, `BL PMT`) that the app must treat a credit balance as normal
rather than as an error.

### More

Account, partners, setting up a site, the trade list.

## Data model

Fourteen tables. One rule governs the shape: **nothing that can be added up is
ever stored.** Every total that is a formula today becomes a calculation; every
total that is hand-typed today also becomes a calculation.

Money has two sides throughout: what is **owed** to someone, and what has been
**paid** to them. The workbooks only ever recorded the second, which is why what
a vendor is owed had to be kept as a separate hand-maintained list.

### people

Everyone — partners, clients, vendors, chokidars. Name, phone, notes.

**No role field.** Sajid Bhai is an investor on some sites and the steel
supplier on others; a role on the person would be wrong on day one.

### siteRoles

`person × site × capacity`, where capacity is partner, client or investor. Roles
live on the relationship, so one person holds different capacities on different
sites without contradiction.

### accounts

The subset of people who sign in — Nauman and the partners. Linked to a Clerk
identity. Clients and vendors exist as people but never log in.

### sites

Name, plot number, block, phase, scheme, stage, covered area, started-on, and a
flag for own build versus built for a client. That flag is the only thing that
decides whether a site shows a sale or a billing section.

### trades

One global chart of accounts, seeded with the roughly 45 canonical trades
derived from the workbooks. Graphy and Corian are kept as distinct trades — both
are real, specific work (an exterior wall finish of cement, plaster of Paris and
bondo; and a mouldable waterproof solid-surface material for counter tops).

Each trade carries a flag: **does this count as building cost?** Plot, taxes and
commission are `false`.

This flag replaces `=SUM(C1674:CM1674)-CA1674`. Building cost is the sum over
trades where the flag is true; plot cost is the sum where it is false. Same
answer, no special column, and it cannot break when a trade is added at the end.

### engagements

A person put on a trade at a site, with what was agreed — a lump sum, or a rate
and a unit. This is the workbooks' vendor sub-header rows becoming real data.

An engagement records only what was **agreed**. What was billed and what was paid
are separate and frequently differ from it and from each other, which is the
whole point of the 199-M variance sheet.

### bills

What a person is owed. Date, person, site, trade, amount, their own bill or
challan number, and a description.

This is the half the workbooks never held properly. Without it, a
subcontractor's outstanding can only be guessed at as agreed-minus-paid, which
works for Akram on a lump sum and fails completely for a steel supplier
delivering load after load with no fixed contract.

Three separate figures exist for every subcontractor and all three are needed:

| | Comes from | Example |
|---|---|---|
| Agreed | the engagement | Akram, civil labour, 300,000 |
| Billed | bills raised | 340,000 once extra work landed |
| Paid | payments | 325,000 so far |

The spread between agreed and billed is what the 199-M sheet labels *"due to
extra work or redoing"*. The spread between billed and paid is the balance.

**Payments settle the balance, not specific bills.** In practice money goes out
on account — 50,000 to the tile fixer, not against bill number seven. Chasing a
bill-by-bill match would be bookkeeping the business does not actually do. A
payment may optionally be linked to a bill for the cases where it matters, but
it is never required.

### The person account

Not a table. A person's account is their bills and their payments in date order
with a running balance, derived on read and spanning every site.

Positive means money is owed to them. Negative means they hold an advance, which
is normal and appears throughout the workbooks as `ADV` and `BL PMT`.

**Market payables become a calculation.** The register kept by hand in the Khalid
Mirza file — Dura Tiles 763,701, Kabinet King 770,000, totalling 1,591,701 — is
simply the sum of everyone's outstanding balance. It stops being a list someone
has to remember to update.

### payments

The heart of the app. One filled amount cell in a workbook equals one row here.

| Field | Meaning |
|---|---|
| site, date, trade | which site, when, what for |
| paid to | a person, or blank for a one-off shop |
| amount | stored as whole paisa |
| how paid | cheque / cash / transfer / pay order |
| reference | the cheque number |
| bank | which account it left |
| note | free text, kept as written |
| extra work | the flag behind `LESS EXTRA WORK` |
| paid by | whose money it was — this is the partner split |
| added by, changed at | never shown up front |

Two consequences fall out of this shape:

- **Supervision charges need no special case.** They are a payment whose *paid
  to* is Nauman. That makes them a site cost and his income simultaneously, from
  one row, entered once.
- **Parallel partner ledgers disappear.** The 487-R arrangement of two separate
  ledgers on one house becomes one site with each payment tagged by whose money
  it was. The 58,641 reconciliation gap becomes arithmetically impossible.

### moneyIn

Partner capital, client payments, sale proceeds. Date, amount, from whom, how,
which bank, and optionally which billing stage it settles.

Replaces the 22 figures currently welded inside a single spreadsheet formula
with no dates and no detail.

### contracts

Client jobs. A lump sum, or a rate against covered area, holding agreed area and
actual area separately so a re-measurement is a calculation rather than a
rebuilt table.

### milestones

Payment stages: order, description, percent, amount, billed-on. What has been
received is derived from `moneyIn`.

### extraWorkBills and extraWorkBillLines

Bill number, date, status. Lines carry description, quantity, unit, rate, amount
and the dimension working (`39.75' × 0.375' × 11'`) as text beside the number,
because that working is what makes the bill defensible to a client.

### bankAccounts

A label such as "Askari 2192". Full account numbers are stored masked and never
rendered in full, since a partner may screenshot any screen.

### Derived, never stored

Site totals, trade breakdowns, every person's running balance, market payables,
the agreed-versus-billed-versus-paid spread per engagement, what a client owes,
each partner's position, and profit on sale. None of it is stored, so none of it
can go stale or disagree with itself.

## Architecture

**Stack.** TanStack Start on React, Vite, Tailwind v4, shadcn/ui. Convex for
data. Clerk for sign-in. Cloudflare Pages with GitHub Actions. Vitest. yarn.

**Base.** The codebase starts from the `blueprint2` template, which is already
this exact stack wired together. It is taken **as code only** — nothing is
connected to the organisation the template came from. No shared account, no
shared Convex team, no shared Cloudflare account, no Jira, no Notion, no
inherited CI secrets. Every piece of infrastructure is Nauman's own:

| | |
|---|---|
| Repository | `saadings/construction`, private |
| Convex | `dev/saad-nauman`, `production` |
| Clerk | `secure-goose-32` |
| Cloudflare | Nauman's own account |

The template supplies four things this spec already asked for, so building them
by hand would be reinventing patterns that already exist:

- **`authenticatedQuery` and `authenticatedMutation`** with `ctx.identity` — the
  single shared access-check helper the architecture section calls for
- **Clerk → Convex account sync** over webhooks, with Svix signature validation
- **Vitest with `convex-test`** and Testing Library, matching the testing plan
- CI/CD, ESLint 9, Prettier, Husky, typed environment variables, and theme
  handling

Because the template already carries the Clerk wiring, **`clerk init` is not
run.** That also removes the earlier risk of scaffolding into a directory that
already holds a repository and documents.

**What must be removed, not merely renamed.** A company template carries company
identifiers in places that are not visible on the surface — deploy scripts, CI
workflow files, project and account identifiers, package names, environment
variable names. Pass one includes an explicit audit for these, and the bar is
that no identifier belonging to the originating organisation survives anywhere
in the tree, not just that the visible naming reads "construction".

**The Clerk organisation tables are stripped.** The template ships
`organizations` and `organizationMembers` to mirror Clerk organisations. This app
grants access through `siteRoles` — a person is a partner *on a site*, not a
member of a company-wide organisation. Keeping both would leave two membership
concepts side by side, one of which does no work, which is exactly the sort of
thing that misleads whoever next reads the schema. Site roles stay; the
organisation tables and their webhook handlers go.

**Convex deployments.** Both supplied by Nauman, both empty and never deployed
at the time of writing.

| | Name | Cloud URL |
|---|---|---|
| Development | `dev/saad-nauman` (handsome-ferret-39) | `https://handsome-ferret-39.convex.cloud` |
| Production | `production` (dapper-crab-709) | `https://dapper-crab-709.convex.cloud` |

Both in US East (N. Virginia). Production is written to only by CI, never from a
local machine.

**Convex tooling.** The MCP server is used for everything it covers — reading
data, environment variables, logs, running functions, inspecting schema.

The CLI is permitted for exactly two jobs, because neither has an MCP, REST or
dashboard equivalent:

1. **Linking the folder to a deployment.** The MCP reads `CONVEX_DEPLOYMENT`
   from `.env.local`; without it, `status` returns *"No CONVEX_DEPLOYMENT set"*
   and no deployment is reachable.
2. **Pushing backend code.** `npx convex dev` locally, `npx convex deploy` in
   CI.

Any other Convex operation that reaches for the CLI is a mistake — use the MCP.

Deployment identity is confirmed with a self-identifying check against
`CONVEX_CLOUD_URL`, never inferred from what the tables happen to contain.

`envList` is never called — it returns values, and would print every secret in
the deployment into the transcript. Individual variables are read with `envGet`.

**Clerk setup.** Clerk application `app_3HtvD50uWRgMamAXhVkdYnROFHm`, instance
`secure-goose-32`. The template already carries the Clerk integration, so setup
is configuration rather than scaffolding: supply the keys, point Convex at the
issuer, create the JWT template.

`clerk init` is **not** run, and neither is the Next.js proxy-matcher step from
the supplied Clerk instructions — that step applies only to Next.js, and this is
TanStack Start. `clerk doctor` is still useful for verifying the result.

Because shadcn/ui is in the stack, `@clerk/ui` is installed and its shadcn theme
applied so Clerk's screens match the rest of the app rather than looking bolted
on.

Three environment values are held in `.env.local`, which is gitignored and was
created with `600` permissions:

```
VITE_CLERK_PUBLISHABLE_KEY   # public by design
CLERK_SECRET_KEY             # never reaches client code
CLERK_FRONTEND_API_URL       # https://secure-goose-32.clerk.accounts.dev
```

The template validates environment variables through a typed schema, so its
expected names must be reconciled with these during pass one rather than
assumed to match.

**Cloudflare.** A dedicated account named "Construction" — confirmed by asking
Cloudflare, not inferred. `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are
set as repository secrets on `saadings/construction`, which is what CI deploys
with, and also held in `.env.local`.

Two decisions taken knowingly by Nauman, recorded so they read as choices rather
than oversights:

- **The production token is also kept locally.** It makes deploy problems
  quicker to diagnose by hand. It also means the standing rule against deploying
  to production from a local machine rests on discipline rather than on the
  credential simply being absent.
- **The credentials are not rotated**, despite having been shared in plain text.
  The account is dedicated to this project and holds nothing else, which bounds
  the exposure to this app.

**R2 is not used and its keys are stored nowhere.** The first version has no file
storage — photo attachments are an explicit non-goal — so object storage
credentials would be exposure bought for nothing. Worth knowing if they ever are
needed: R2's access key ID is the API token's own ID, so the two are one
credential and rotating either rotates both.

Keys live in `.env.local`, which is gitignored from the first commit.
`CLERK_SECRET_KEY` never reaches client code, and environment files are never
read aloud or printed.

**Clerk instance.** Frontend API `https://secure-goose-32.clerk.accounts.dev`,
backend API `https://api.clerk.com`. The frontend URL was confirmed
independently — it is what the publishable key decodes to — rather than taken on
trust.

**Joining Clerk to Convex.** Convex validates Clerk's JWTs itself; the frontend
API URL is the issuer domain it needs. Three pieces:

1. `CLERK_JWT_ISSUER_DOMAIN=https://secure-goose-32.clerk.accounts.dev` set as an
   environment variable **on the Convex deployment**, not only in `.env.local`.
   Set through the MCP server (`envSet`), never the CLI, and never via `envList`,
   which returns values and would print every secret in the deployment.

2. `convex/auth.config.ts`:

   ```ts
   import { AuthConfig } from "convex/server";

   export default {
     providers: [
       {
         domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
         applicationID: "convex",
       },
     ],
   } satisfies AuthConfig;
   ```

   This file is mandatory. Without it `ctx.auth.getUserIdentity()` returns
   `null` and every access check silently denies — which looks exactly like a
   permissions bug and is not one.

3. **A JWT template named `convex` in the Clerk dashboard.** `applicationID` is
   checked against the token's `aud` claim, so the template's name must match
   exactly. There is no CLI or API route for creating it — Nauman must add it at
   dashboard.clerk.com under JWT Templates. Auth cannot work until this exists.

The backend API is only needed if the app ever calls Clerk directly to look up
users. Nothing in the first version requires it.

**Access.** Clerk proves identity; Convex decides reach. Every query and
mutation runs the same check — does this person hold a role on this site? If
not, the data never leaves the server. This is a server condition, not a hidden
button. Nauman can create sites and add partners; a partner has full equal
access on sites he is on.

**Live by default.** Convex queries are reactive. A partner records a payment on
his phone and it appears on everyone else's without a refresh, because there is
one copy of the data. This is the whole answer to three files that disagree.

**Atomic day sheets.** Logging eight trades against one cheque run is a single
write — all eight or none. No half-saved sittings.

**Light offline**, in three parts:

- What is being typed is held on the device as it is typed, surviving reload,
  tab close and signal loss.
- A saved entry appears immediately and is sent when the connection returns;
  Convex retries on its own.
- One plain line while disconnected: *"No connection — what you've entered is
  saved on this phone and will go up when you're back online."*

No conflict resolution, because two people are never editing offline
simultaneously. That was the expensive part of true offline and it is not being
paid for.

**Money is stored as whole paisa.** Payments are whole rupees, but client
contracts are not — one contract is `6,057,704.50` with stages running to
`908,655.67`. Floating point would lose fractions across thousands of rows and
totals would stop matching. Whole integers cannot drift. Screens still show
rupees.

**Dates are stored as dates, not moments.** `2025-10-07` — no time, no timezone.
The workbooks hold no time and the app must not invent one, which is how a
payment made in Lahore at 9pm gets filed on the wrong day.

**Totals are computed on read**, in Convex, so everyone sees one number. A site
with a few thousand payments totals instantly with indexes on `site + date` and
`site + trade`. A rollup table earns its place only if a site ever grows enough
to feel slow.

**Code boundaries.** One Convex file per area — sites, payments, people,
engagements, money in, contracts — each owning its own queries and mutations and
nothing else. A single shared access-check helper used by all of them, so
permissions have one place to be correct. Money and date formatting live in one
module used everywhere, so a figure looks identical on every screen.

## Validation

Validation is a first-class requirement, not a finishing touch.

**One rule, written once, enforced three times.** Each thing that can be entered
has a single Zod schema in a shared module. That schema:

- drives the form as it is typed (Zod v4 implements Standard Schema, so
  TanStack Form consumes it directly)
- becomes the Convex function's argument validator via `zCustomMutation` from
  `convex-helpers/server/zod4`, so a malformed call is rejected at the server
  boundary before any handler runs
- produces the TypeScript types, so form and server cannot drift apart

Client-side checking exists for speed of feedback. The server is the authority.
They agree because they are the same file.

```ts
// shared/validation/payment.ts
export const paymentInput = z.object({
  siteId:      zid("sites"),
  date:        dateOnly,
  tradeId:     zid("trades"),
  paidToId:    zid("people").optional(),
  newPerson:   personName.optional(),
  amount:      rupees,
  method:      z.enum(["cheque", "cash", "transfer", "payOrder"]),
  reference:   chequeNumber.optional(),
  bankId:      zid("bankAccounts").optional(),
  note:        z.string().trim().max(300).optional(),
  isExtraWork: z.boolean().default(false),
  paidById:    zid("people"),
})
  .refine(r => r.method !== "cheque" || !!r.reference, {
    path: ["reference"],
    message: "Add the cheque number.",
  })
  .refine(r => !!r.paidToId || !!r.newPerson, {
    path: ["paidToId"],
    message: "Say who was paid.",
  });
```

**Checking happens per field, as it is left** — the way Excel refuses a bad cell
immediately rather than complaining about the whole sheet at the end. A mistake
surfaces beside the field just left, never as a wall of messages after saving.

### Field rules

| Field | Rule |
|---|---|
| Amount | required, non-zero, up to 2 decimals, converted to whole paisa. No hard maximum — anything above Rs 5,000,000 asks for confirmation once rather than being refused, since single plot payments reach Rs 41,475,000. Numeric keypad on phone, commas appear while typing |
| Date | required, a real date, not later than today, warns but does not block if earlier than the site's start date |
| How paid | cheque / cash / transfer / pay order — one must be chosen |
| Cheque number | required when paying by cheque, not asked for otherwise |
| Bank | required for cheque and transfer, hidden for cash |
| Trade | required, must be a real trade |
| Paid to | a person on file, or a new name typed inline, 2–80 characters, trimmed |
| Phone | Pakistani mobile, normalised to `03XX-XXXXXXX` however it is typed |
| Note | optional, trimmed, capped at 300 characters |
| Covered area | positive, between 100 and 20,000 square feet |
| Contract stages | each 0–100, and the set must total exactly 100 |
| Contract rate | positive |
| Bill amount | required, positive, same paisa handling as a payment |
| Bill person | required — a bill always belongs to someone, unlike a payment, which may go to a one-off shop |
| Bill site and trade | both required, so a bill lands in the right place on the right site |
| Bill reference | optional; their bill or challan number, free text, capped |

### Cross-field rules

These matter more than the field rules, because they are what Excel never
enforced and where the workbooks actually went wrong.

- A cheque with no number, or a transfer with no bank, cannot be saved
- Milestone percentages must total exactly 100
- An engagement is a lump sum or a rate, never both
- The extra-work flag cannot be set on plot and taxes
- A client payment tied to a stage cannot exceed that stage
- Actual area must be recorded before a re-measurement bill can be raised
- A payment linked to a bill cannot exceed what is left unsettled on that bill.
  An unlinked payment has no such limit, because paying someone more than they
  have billed is an advance, not a mistake

### Messages

Every message is a plain sentence. *"Add the cheque number."* — never
`reference: Required`, never a field path, never a raw library message. The
no-technical-terms rule applies hardest here, because this is the moment someone
is already stuck.

## Behaviour when things go wrong

**Nothing can be overridden.** There is no box anywhere for correcting a total.
If a figure looks wrong, a payment behind it is wrong and that is what gets
fixed. This is the direct answer to `-58641` and `-33132003` — the app offers no
place to hide a plug figure.

**Nothing is truly deleted.** Removed entries are hidden and recoverable. Every
entry and change keeps who did it and when — never shown up front, always
available when a disagreement needs settling.

**Deleting something in use is refused gently.** A trade with payments against
it, or a person who has been paid, can be hidden from lists but not erased.

**A repeat payment asks, it does not block.** Same site, day, amount and cheque
number prompts "you already have one like this, add anyway?". It cannot refuse,
because cheque numbers do repeat across banks.

**Anyone can be paid immediately.** A name not on file is typed inline and the
person is created in passing. This is how one-off suppliers actually enter the
books, and it must never be a dead end mid-entry.

**There is always an "other" trade.** The workbooks needed one and so does this.
Forcing a choice makes people file things in the wrong place.

**Money can come back.** Credits and refunds are allowed as negative amounts,
shown plainly as money coming back rather than as a minus sign to be squinted
at.

**An advance is not an error.** Paying someone before they have billed anything
puts their account in credit. The app says so in plain words — *"Akram is
holding 50,000 in advance"* — rather than warning about a negative balance. The
workbooks are full of `ADV` and `BL PMT`; this is ordinary practice, not an
exception to be flagged.

**A person can be paid without any bill at all.** Bills are not a precondition
for paying someone. Most day-to-day spending will never have a bill recorded
against it, and the app must not nag for one. Bills exist for the people whose
outstanding actually needs watching.

**Contract stages always total the contract.** Stage amounts are computed in
paisa with the final stage absorbing the remainder, so fourteen stages sum to
exactly the contract value.

**Agreed and actual area are both shown**, along with the difference. The app
never quietly picks one.

**Sessions and signal.** A lapsed sign-in returns to the same place with the
draft intact. Empty screens say what to do next, never "no data".

## Testing

Vitest, written alongside the code. Four areas, ordered by cost of being wrong.

1. **Validation schemas.** Pure functions, table-driven, both directions — a
   cheque with no number is rejected, a cash payment is not asked for one.
2. **Money conversion.** Rupees to paisa and back, round-tripped.
   `6,057,704.50` must survive exactly.
3. **The calculations that replaced the formulas.** Building cost versus plot
   cost, a person's running balance in date order, market payables, the
   agreed/billed/paid spread, a partner's position, milestone rounding, and a
   client's outstanding balance. Balances are tested across sites and through a
   credit position, since an advance must come out negative rather than clamped
   at zero.
4. **Access.** A person with no role on a site receives nothing, tested at the
   Convex function level with `convex-test`, not by hiding a button.

**Golden test against reality.** Figures lifted from the workbooks are used as
test fixtures:

- the 82 payments whose `TOTAL` row is already known
- one own-build site where building cost, plot cost and profit are all known
- the Khalid Mirza market-payables register — thirteen named balances totalling
  1,591,701, which the app must reach by calculation rather than by being told

They are fed through the app's calculations and asserted to produce the same
totals the sheets produce.

This is not migration. The numbers live in the test suite, never in the app's
data. Their purpose is to prove the replacement against figures the business
already trusts, rather than against assumptions made in this document.

No snapshot tests. No tests that only prove a mock was called.

## Delivery order

The scope is too large for a single sitting, so it is built in four passes. Each
pass leaves the app working and usable — nothing is half-finished between them.

1. **Foundation and spending.** Bringing the template in and cutting it loose
   from its origin — stripping every inherited identifier, removing the
   organisation tables, pointing it at Nauman's own Convex, Clerk, GitHub and
   Cloudflare. Then Clerk sign-in working end to end, the Convex schema, access
   checks, the shared Zod module, sites, trades, people, and the day-sheet
   payment flow with its per-trade totals. At the end of this pass the app
   already replaces the widest part of the workbooks.
2. **People and what they are owed.** Bills, engagements, the running account
   per person with its balance, market payables as a calculation, and the
   agreed-versus-billed-versus-paid spread on every engagement.
3. **Money coming in.** Partner capital, sale proceeds, and the profit figure
   that depends on them.
4. **Client jobs.** Contracts, stages, billing, re-measurement, extra-work bills.

Each pass gets its own implementation plan.

## Open items for Nauman

1. **A JWT template named `convex` in the Clerk dashboard.** Blocking, and not
   automatable — no CLI or API route exists for it. Sign-in will appear to work
   while every access check silently denies until this is created.
2. **Partner profit shares.** The workbooks record what each partner happened to
   pay but never state an agreed ratio. Is profit split by capital contributed,
   or by a fixed agreement?
3. **Trade list.** The seeded list of roughly 45 trades needs one review pass
   before go-live, to confirm names and which of them count as building cost.

Resolved during design: historical data (none migrated), who signs in (Nauman
and partners only), partner rights (full equal access), offline behaviour
(light), first-version scope (all four areas), organising principle (sites
first), and the Convex CLI boundary (linking and pushing only).
