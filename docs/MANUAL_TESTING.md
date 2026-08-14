# Testing Construction by hand

This is for Nauman. It assumes you know the business inside out and none of the
tooling, which is the right way round.

Everything below was run on this Mac before it was written. Where it says "you
will see", that is what actually appeared, copied out — not what ought to
appear.

Read the first section before you type anything. One thing is broken, it is not
in the app, and nothing further will work until it is dealt with.

**Contents**

1. [Start here — the app cannot start yet](#1-start-here--the-app-cannot-start-yet)
2. [What has to be on this Mac](#2-what-has-to-be-on-this-mac)
3. [Starting the app](#3-starting-the-app)
4. [Signing up as the first person](#4-signing-up-as-the-first-person)
5. [Telling real sign-in from sign-in that only looks real](#5-telling-real-sign-in-from-sign-in-that-only-looks-real)
6. [Running the checks yourself](#6-running-the-checks-yourself)
7. [When something does not work](#7-when-something-does-not-work)

Two words appear throughout and are worth pinning down now:

- **Clerk** is the service that signs people in. It holds names, email
  addresses and passwords.
- **Convex** is where everything the app records is kept — sites, payments,
  people. Two of these exist for this project: one for trying things out
  (`handsome-ferret-39`) and one for real use later (`dapper-crab-709`).
  Everything in this document is about the first one.

---

## 1. Start here — the app cannot start yet

### What you will see

Open Terminal, go to the project, and start it:

```
cd ~/Desktop/construction
yarn dev
```

It gets partway and then falls over:

```
====================================
 CONSTRUCTION DEV
 Workbench: main
 Frontend:  http://localhost:3000
====================================

[frontend]   VITE v7.3.1  ready in 1433 ms
[frontend]   ➜  Local:   http://localhost:3000/
[convex] ✖ Cannot prompt for input in non-interactive terminals. (What would you like to configure?)
[convex] cd "/Users/saadings/Desktop/construction" && npx convex dev exited with code 1
--> Sending SIGTERM to other processes..
[frontend] exited with code SIGTERM
```

In your own Terminal you will not get that first message about prompting.
Instead it will stop and ask you a question — **What would you like to
configure?** — which is the moment this whole section is about. Do not answer
it yet.

The `http://localhost:3000` address is printed, so it looks as though something
is up. It is not. The two halves start together and are wired to stop together,
so when Convex fails the front end is shut down a second later. If you open
that address in a browser you get nothing.

### Why

The app has no store attached to it. This folder has never been told which
Convex store it belongs to, so when it starts it asks — and it cannot ask,
because the command line is signed in as an account that cannot see your stores
at all.

Both of your stores are real and running. They answer when asked directly. But
the account currently signed in on this Mac is told they do not exist when it
goes looking for them.

### Find out which account is signed in

```
npx convex login status
```

You will get something of this shape:

```
Convex account token found in: /Users/saadings/.convex/config.json
Status: Logged in
Teams: 6 teams accessible
  - Saad Nauman's team (saad-nauman-733ff)
  - ...
```

**Read that carefully, because it is a trap.** A team called *Saad Nauman's
team* is listed, and this is still the wrong account. Someone else can have a
team with your name on it, and does. The account name looking familiar is not
evidence of anything. The only thing that settles which store you are attached
to is the name `handsome-ferret-39`, and that name is checked further down.

### The two ways to fix it

Either one works on its own. You do not need both.

**Option A — sign the command line in as the account that owns the stores.**

```
npx convex logout
npx convex login
```

The second command opens a browser window. Sign in there as the account that
owns `handsome-ferret-39` — the same one you use when you look at the Convex
dashboard and can see your data. Then run `npx convex login status` again and
check the list of teams has changed.

**Option B — invite the account that is signed in now onto the team that owns
the stores.** Do this from the Convex dashboard, signed in as the owning
account: open the team, go to its members, and send the invitation. Once it is
accepted, the account already signed in on this Mac can see the stores and
nothing else needs to change here.

Option A is quicker if you have the owning account's password to hand. Option B
is better if more than one person will ever work on this.

### The trap — read this before answering any question on screen

Once the account is sorted, run:

```
npx convex dev --once
```

It asks:

```
? What would you like to configure?
  create a new project
  choose an existing project
```

Three rules for this prompt:

1. **Never pick "create a new project".** That makes an empty new store and
   attaches the app to it. Everything would then appear to work while going
   nowhere near your data.

2. **`dev/saad-nauman` is not this project.** It reads like it, which is
   exactly the danger. Under the account currently signed in, that name points
   at a completely different project called `peekaboo-tracker`. Picking it
   would attach this app to a stranger's store, and nothing on screen would
   ever tell you — payments would save, screens would fill up, and none of it
   would be in your books.

3. **The only name that settles it is `handsome-ferret-39`.** Not the project
   name, not the team name, not the account name. Look for that.

### Prove it attached to the right place

Do this immediately afterwards, every time. It takes a second and it is the
only thing standing between you and a silent wrong turn:

```
grep -E 'CONVEX_DEPLOYMENT|VITE_CONVEX_URL' .env.local
```

Two lines come back, and **both must contain `handsome-ferret-39`**:

```
CONVEX_DEPLOYMENT=dev:handsome-ferret-39 ...
VITE_CONVEX_URL=https://handsome-ferret-39.convex.cloud
```

If either line names anything else — `peekaboo-tracker`, or some name you have
never seen — stop there. Do not start the app, do not sign up, do not enter
anything. Go to the recovery step below.

### If it attached to the wrong place

```
npx convex logout
npx convex login
npx convex dev --once --configure existing
```

The `--configure existing` on the end matters. Once a store has been written
into the file, the ordinary command stops asking and just uses it, so without
that ending you would be sent straight back to the wrong store. With it, you
are asked again — and rule 3 above applies again.

Then run the `grep` check again and confirm both lines say
`handsome-ferret-39` before going any further.

### What "it worked" looks like

`npx convex dev --once` finishes and hands you back the prompt without an
error, and the `grep` check shows `handsome-ferret-39` on both lines. That is
the blockage cleared. Everything after this point should behave.

---

## 2. What has to be on this Mac

**Terminal** is the app you type these commands into. Hold `Cmd` and press the
space bar, type `Terminal`, press Return.

Everything in this document is run from the project folder, so start every
session with:

```
cd ~/Desktop/construction
```

Then check the four things the project needs. Run each line and compare.

| Type this        | You should get                      | If you do not                                                              |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| `node -v`        | a version number, `v22` or higher   | install Node from nodejs.org, take the version it offers you                |
| `corepack -v`    | a version number such as `0.28.0`   | it comes with Node — reinstalling Node fixes it                            |
| `yarn -v`        | `4.13.0`                            | run `corepack enable`, then try `yarn -v` again                             |
| `git --version`  | a version number such as `2.55.0`   | run `xcode-select --install` and accept the prompt                          |

`corepack enable` has already been run on this Mac and does not need running
again. Running it a second time does no harm. If it answers with a permission
complaint, that is the one command in this document you may put `sudo` in front
of.

Then install what the project depends on:

```
yarn install
```

This takes a minute the first time and a moment after that. The last line
begins with `Done`. It may say `Done with warnings` — that is normal and not a
problem.

---

## 3. Starting the app

```
yarn dev
```

**What "it worked" looks like.** The heading prints, then a run of lines from
both halves, and then it sits there and stays. It does not return you to the
prompt. That last part is the real signal — the failure in section 1 ends by
giving the prompt back, and a healthy start never does.

```
====================================
 CONSTRUCTION DEV
 Workbench: main
 Frontend:  http://localhost:3000
====================================

[frontend]   VITE v7.3.1  ready in 1433 ms
[frontend]   ➜  Local:   http://localhost:3000/
```

Lines marked `[convex]` should also appear and should not mention an error.

Now open **http://localhost:3000** in a browser. You should see:

- the heading **Construction**
- underneath it, **Sites, spending and what everyone is owed.**
- two buttons: **Sign in** and **Create an account**

That is the whole app today. There is nothing else to click yet, and that is
expected — this stage was about getting the foundations right, not the screens.

**To stop it**, click on the Terminal window and hold `Ctrl` and press `C`.

**If the address shows nothing**, look back at the Terminal. If it has returned
you to the prompt, go back to section 1 — it is the store, not the browser.

---

## 4. Signing up as the first person

Click **Create an account**. A panel opens on top of the page. Put in your
email address and a password and follow it through; Clerk will email you a code
to confirm the address.

**What "it worked" looks like.** The panel closes on its own and the two
buttons are gone, replaced by a small round picture button. Clicking that opens
a little menu with your name on it and a way to sign out.

You are the first person on the system. There is no approval step and nobody to
let you in — that is by design for now, and worth remembering before this is
ever put anywhere public.

**If the panel will not open at all**, or opens and shows a complaint rather
than a form, the sign-in service is not reachable and section 7 covers it.

**Do not stop here.** The round picture button appearing is the single most
misleading moment in this whole project. That is the next section, and it is
the one that matters.

---

## 5. Telling real sign-in from sign-in that only looks real

**The screen cannot tell you, and it never will.**

Signing in is done by Clerk. Storing everything is done by Convex. They are two
separate companies' services and they are joined together by settings that live
outside the app entirely. If that join is broken, Clerk still signs you in
flawlessly — the panel closes, the round picture button appears, your name is
in the menu, everything looks completely normal — and Convex quietly refuses
every single thing the app asks it for.

There is no message. Nothing turns red. A perfect sign-in and a useless one are
identical on screen. So the check has to be made somewhere the app cannot mask
it, and that is what follows.

You will need two websites, both of which you already have accounts on:

- the Convex dashboard, **dashboard.convex.dev**
- the Clerk dashboard, **dashboard.clerk.com**

Sign in to the Convex dashboard as the account that owns your stores, and open
`handsome-ferret-39`. If you cannot find it there, that is the same problem as
section 1 wearing a different hat.

### Check 1 — the setting that carries the join

This is the one that produces the fake sign-in, so do it first.

In the Convex dashboard, with `handsome-ferret-39` open, go to **Settings**,
then **Environment Variables**.

**Expected:** a variable named `CLERK_FRONTEND_API_URL`, and its value is
exactly this, character for character:

```
https://secure-goose-32.clerk.accounts.dev
```

That address is not a guess. It is stored inside the sign-in key this project
already uses, and it was read back out of it to confirm the two agree.

**Why "exactly" is doing real work here.** This value is compared letter by
letter against a marker carried inside every sign-in as it arrives. A trailing
slash on the end, a missing letter, `http` where it should be `https` — any of
those and every arrival is turned away. And when arrivals are turned away, the
app does not complain. It just gets nothing back, forever, while sign-in on
screen carries on looking perfect. This is the fake sign-in, and this variable
is where it comes from.

**Also expected on that same page:** a variable named `CLERK_WEBHOOK_SECRET`,
whose value begins `whsec_`. Check 3 is about what happens when that one is
missing.

**If either is missing**, add it on that page. The first one's value is written
above. The second one's comes from Clerk — see check 3.

> One thing worth knowing so it does not surprise you later: when work is
> published for real, these two settings get put onto the **live** store
> automatically. That automatic step does not touch this trying-things-out
> store. So on `handsome-ferret-39` they are set by hand, once, and this check
> is how you know they are still there.

### Check 2 — find yourself in the store

Having signed up in section 4, look for yourself.

In the Convex dashboard, with `handsome-ferret-39` open, go to **Data** and
select the **users** table.

**Expected:** one row, carrying the email address you signed up with.

**What this proves:** Clerk reached Convex, Convex was satisfied the message
was genuine, and the row was written. That is a real end-to-end round trip
between the two services and it is worth having.

**What this does not prove:** that the app's own requests are accepted. Those
travel a different road — the app asks Convex directly, carrying proof of who
you are, and check 1 is the setting that road depends on. Both checks are
needed. Neither substitutes for the other.

**If the table is empty**, do not assume it is broken until you have done check
3. An empty table and a table you are looking at through the wrong window are
indistinguishable, and check 3 asks a service that keeps its own record.

### Check 3 — Clerk's own record of what happened

This is the decisive one, because Clerk writes down every attempt it made and
exactly what came back.

In the Clerk dashboard, go to **Webhooks**, open the endpoint pointing at
`https://handsome-ferret-39.convex.site/webhooks/clerk`, and look at the list
of attempts. Find the one from when you signed up.

Three things can be there. The app was written to answer in exactly these three
ways and no others, so whichever you see means precisely what the row says:

| What Clerk shows                                             | What it means                                                                     | What to do                                                                                                                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **200**                                                       | It worked. Your row is in the store.                                              | Nothing. Go back to check 2 and it will be there.                                                                                                                                 |
| **400**, saying `Invalid webhook signature`                   | The secret sitting on the store is not the one Clerk is signing its messages with. | On this same Clerk page, reveal the signing secret and copy it. Put it on the store as `CLERK_WEBHOOK_SECRET` (check 1's page). Then use Clerk's **Resend** on the failed attempt. |
| **500**, saying `This deployment cannot check webhooks yet`   | The store has no signing secret at all, so it cannot tell a genuine message from a forged one and refuses to guess. | Same fix — copy the signing secret from Clerk onto the store. But see the note below, because you do not need to resend anything.                                                 |

**About that 500.** It is deliberate, and it is on your side. The app could
have shrugged and answered "fine" — and your sign-up would have been thrown
away for good. Instead it says plainly that it cannot do the check, which makes
Clerk hold on to the message and keep trying for a while. So once you put the
signing secret on the store, the sign-ups already made land by themselves. You
do not have to sign up again.

### What none of this proves yet, and when it will

Today the app has one screen and that screen asks Convex for nothing at all.
There are no requests, so there is nothing to watch being accepted or refused.
The three checks above are everything that can honestly be proven at this
stage, and check 1 is the precondition the rest of it rests on.

The final proof arrives with the first screen that shows your sites. At that
moment the test becomes something you can see with your own eyes and needs no
dashboard:

- **Genuinely working** — the list of sites appears and stays on screen.
- **Only looking like it works** — the list never finishes loading, or sits
  there empty while you know perfectly well there are sites in it.

If check 1 is right, that will work. If check 1 is wrong, that empty list is
exactly what you will get, and you will now know where to look.

---

## 6. Running the checks yourself

These are the same checks that run automatically before any work is saved and
again on GitHub. Running them yourself is how you satisfy yourself that what
you have been handed is sound, without taking anybody's word for it.

Run them from `~/Desktop/construction`, one at a time.

| Command             | What it looks at                                                | Passing looks like                                                                 |
| ------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `yarn lint:check`   | common mistakes and sloppy patterns across every file            | prints **nothing at all** and returns you to the prompt                            |
| `yarn format:check` | everything is laid out the same way                              | `Checking formatting...` then `All matched files use Prettier code style!`          |
| `yarn typecheck`    | nothing is being used in a way that does not fit                 | prints **nothing at all** and returns you to the prompt                            |
| `yarn test`         | the app's own tests                                              | `Test Files  3 passed (3)` and `Tests  23 passed (23)`                             |
| `yarn test:scenario`| the tests guarding the setup itself — secrets, workbooks, wiring | `Test Files  3 passed (3)` and `Tests  30 passed (30)`                             |
| `yarn build`        | the app can be packaged up for real use                          | ends with `[prerender] Prerendered 1 pages:` and `[prerender] - /`                  |

All six pass right now. That was confirmed immediately before this document was
written, on this Mac, with the wording above copied from what actually printed.

Two things worth knowing so they do not alarm you:

- **Nothing printed is the good outcome** for the first and third. Those tools
  only speak up when something is wrong. Silence is the pass.
- **The two test counts will grow.** As more of the app gets built, 23 and 30
  climb. The number is not the point — what matters is that the word next to it
  is `passed` and that no line says `failed`.

The tests that matter most to you are the second set. They are what makes sure
the family's spreadsheets and every password and key stay out of anything that
gets published, that this project stays cut loose from where its starting code
came from, and that the three answers in check 3 above stay exactly as
described.

---

## 7. When something does not work

| What you see                                                                     | What it actually is                                                 | What to do                                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `yarn dev` prints the heading, then gives you the prompt back                      | No store attached                                                   | Section 1, from the top                                                               |
| It asks **What would you like to configure?**                                      | Same thing — it is asking because it does not know                  | Section 1, and read the three rules before answering                                  |
| `command not found: yarn`                                                          | The package manager is not switched on                              | `corepack enable`, then try again                                                     |
| `command not found: npx`                                                           | Node is not installed                                               | Section 2                                                                             |
| The browser page never loads                                                       | It stopped in the Terminal; the browser is only the messenger       | Look at the Terminal, then section 1                                                  |
| The sign-in panel will not open                                                    | The browser cannot reach the sign-in service                        | Check the internet, then that `VITE_CLERK_PUBLISHABLE_KEY` is present in `.env.local`  |
| Signed in fine, but the **users** table is empty                                   | Could be the secret, could be your window                           | Check 3 — it tells you which, exactly                                                 |
| `.env.local` names a store you do not recognise                                    | It attached to the wrong place                                      | Stop. Enter nothing. Recovery step in section 1                                       |
| A check in section 6 fails after you have changed nothing                          | Not something to fix from here                                      | Copy the output and send it on                                                        |

### Two rules that are worth more than everything above

**Never send anyone the file called `.env.local`.** Every key and password this
project has is in it. It is deliberately kept out of everything that gets
published, and there are tests whose whole job is to keep it that way. If
somebody needs to see it, read out the one line they asked for.

**The spreadsheets stay on this Mac.** The six workbooks in this folder carry
bank account numbers, suppliers' mobile numbers and named clients' financial
records. They are deliberately excluded from anything that leaves the machine,
and a test in `yarn test:scenario` fails on purpose if that ever stops being
true.

### When you get stuck

Send back three things and it can be picked up from there:

1. What you typed.
2. Everything the Terminal printed after it — all of it, not a summary.
3. Which section you had got to.
