import { Link } from '@tanstack/react-router'
import { ArrowDownToLine, ArrowUpFromLine, Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '../form/Button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'

// `New entry`, and the question behind it: which of the two ledgers this is going into.

// The whole app turns on that separation. A payment is a cost and somebody is owed for it; a receipt is not a cost and nobody is owed anything because of it. A single `Add` that guessed from context is the one control that could put a partner's capital in as an expense.

// His drawing said `Money going out` and `Money coming in`, which are the phrases he had already called slop -- "Coming In Going out, all of such language is just slop". Asked which he wanted, he answered: **"Money Come in should be Receipts, and Money Going out should be called payments"**.

// So these are his words rather than a stand-in. His sentences underneath are as drawn, less the trailing `Goes in the daybook` and `Goes in receipts` -- the heading is that clause, and saying it twice is what a person editing their own draft would cut.
const WHERE_IT_GOES = [
  {
    to: '/daybook',
    said: 'Payments',
    what: 'A payment to a supplier, subcontractor or labour.',
    icon: ArrowUpFromLine,
    tone: 'bg-brass-tint text-brass',
    hover: 'hover:border-brass',
  },
  {
    to: '/receipts/new',
    said: 'Receipts',
    what: 'Partner capital, a client payment, or a house sold.',
    icon: ArrowDownToLine,
    tone: 'bg-green-tint text-green',
    hover: 'hover:border-green',
  },
] as const

export function WhatAreYouRecording() {
  // Closed behind whichever was chosen. A dialog still open over the screen it just opened is a thing to dismiss, and the dismissal is what gets forgotten while holding a cheque book.
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {/* At every width, as drawn. It is the first time this bar has held three controls on a phone -- the hamburger, the search and this -- and each of them clears 44. */}
        <Button className="shrink-0 whitespace-nowrap">
          <Plus className="size-4 shrink-0" aria-hidden />
          New entry
        </Button>
      </DialogTrigger>

      {/* No width said here. His dialog caps at the width shadcn's own `DialogContent` already caps at, on the `fixed` element itself -- and saying it again in a class list of ours would be that cap on something that does not declare itself an overlay, which `width.test` refuses because that is exactly what a page container capped at a phone looks like. */}

      {/* Written without naming the class, which is not squeamishness: that sweep reads source and cannot tell a comment from a class list, so a comment explaining the rule trips it. Fourth time in this repository -- the better the comment, the more likely the false positive. */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What are you recording?</DialogTitle>
          <DialogDescription>The two ledgers are kept apart. Pick the direction the money moved.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {WHERE_IT_GOES.map((where) => (
            <Link
              key={where.to}
              to={where.to}
              onClick={() => {
                setOpen(false)
              }}
              // No `ROOM_FOR_A_THUMB` here, and that is deliberate rather than forgotten: it hands its height straight back with a negative margin, which is right for a row in a list and wrong for a card that is already three lines and 100px tall.
              className={`border-input bg-card flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors ${where.hover}`}
            >
              <span className={`flex size-9 items-center justify-center rounded-full ${where.tone}`}>
                <where.icon className="size-4" aria-hidden />
              </span>
              <span className="text-sm font-semibold">{where.said}</span>
              <span className="text-muted-foreground text-[0.8125rem]">{where.what}</span>
            </Link>
          ))}
        </div>

        {/* His own footer, on its own rule. The `X` in the corner is shadcn's and stays: taking it out is a change to every dialog in the app, and it is the one dismissal a keyboard reaches first. Two ways out of a dialog is his drawing plus the app's, and neither is wrong. */}
        <div className="border-border flex justify-end border-t pt-5">
          <Button
            look="beside"
            onClick={() => {
              setOpen(false)
            }}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
