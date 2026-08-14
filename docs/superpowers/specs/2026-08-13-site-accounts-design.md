# Site Accounts — Design

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
- **People on this site** — who is on which trade, agreed / paid / left
- **Money coming in** — partner money, client payments, sale
- **Billing** — client sites only. Stages, billed, received, due.

### Adding a payment

A day-sheet flow, not a form repeated eight times. Site and date are chosen
once, then trade → who → how much → how paid → note, with "add another" keeping
the site and date. A running total for the sitting stays at the top.

This matches how the work actually happens: one cheque run on a Tuesday
touching eight trades.

### People

Everyone who gets paid, across all sites. Tapping one shows their trade, phone,
and every site they have worked on with amounts.

### More

Account, partners, setting up a site, the trade list.

## Data model

Thirteen tables. One rule governs the shape: **nothing that can be added up is
ever stored.** Every total that is a formula today becomes a calculation; every
total that is hand-typed today also becomes a calculation.

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
Paid, remaining and over/under are calculated, never stored.

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

Site totals, trade breakdowns, what a vendor has left, what a client owes, each
partner's position, and profit on sale. None of it is stored, so none of it can
go stale or disagree with itself.

## Architecture

**Stack.** TanStack Start on React, Vite, Tailwind v4, shadcn/ui. Convex for
data. Clerk for sign-in. Cloudflare Pages with GitHub Actions. Vitest. yarn.

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

### Cross-field rules

These matter more than the field rules, because they are what Excel never
enforced and where the workbooks actually went wrong.

- A cheque with no number, or a transfer with no bank, cannot be saved
- Milestone percentages must total exactly 100
- An engagement is a lump sum or a rate, never both
- The extra-work flag cannot be set on plot and taxes
- A client payment tied to a stage cannot exceed that stage
- Actual area must be recorded before a re-measurement bill can be raised

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
   cost, what a vendor has left, a partner's position, milestone rounding, a
   client's outstanding balance.
4. **Access.** A person with no role on a site receives nothing, tested at the
   Convex function level with `convex-test`, not by hiding a button.

**Golden test against reality.** Figures lifted from the workbooks are used as
test fixtures — the 82 payments whose `TOTAL` row is already known, and one
own-build site where building cost, plot cost and profit are all known. They are
fed through the app's calculations and asserted to produce the same totals the
sheets produce.

This is not migration. The numbers live in the test suite, never in the app's
data. Their purpose is to prove the replacement against figures the business
already trusts, rather than against assumptions made in this document.

No snapshot tests. No tests that only prove a mock was called.

## Delivery order

The scope is too large for a single sitting, so it is built in four passes. Each
pass leaves the app working and usable — nothing is half-finished between them.

1. **Foundation and spending.** Project setup, Clerk sign-in, Convex schema,
   access checks, the shared Zod module, sites, trades, people, and the day-sheet
   payment flow with its per-trade totals. At the end of this pass the app
   already replaces the widest part of the workbooks.
2. **People and what they are owed.** Engagements, agreed versus paid versus
   left, the cross-site people view.
3. **Money coming in.** Partner capital, sale proceeds, and the profit figure
   that depends on them.
4. **Client jobs.** Contracts, stages, billing, re-measurement, extra-work bills.

Each pass gets its own implementation plan.

## Open items for Nauman

1. **Permission to `git init` and commit.** The folder is not yet a repository.
2. **Partner profit shares.** The workbooks record what each partner happened to
   pay but never state an agreed ratio. Is profit split by capital contributed,
   or by a fixed agreement?
3. **Trade list.** The seeded list of roughly 45 trades needs one review pass
   before go-live, to confirm names and which of them count as building cost.

Resolved during design: historical data (none migrated), who signs in (Nauman
and partners only), partner rights (full equal access), offline behaviour
(light), first-version scope (all four areas), organising principle (sites
first), and the Convex CLI boundary (linking and pushing only).
