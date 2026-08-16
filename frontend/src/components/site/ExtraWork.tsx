import { Fragment, useState } from 'react'
import { todayOnThisDevice } from '~shared/calendarDate'
import { formatPaisa, groupWhileTyping } from '~shared/money'
import { extraWorkBillInput, extraWorkLineInput, lineAmountPaisa } from '~shared/validation/extraWork'
import { calendarDay, positiveMoney, whatIsWrong } from '~shared/validation/primitives'

import { Button } from '../form/Button'
import { Day } from '../form/Day'
import { Field, Line } from '../form/Field'
import { WayOut } from '../form/WayOut'
import { whatWentWrong } from '../form/whatWentWrong'
import { Figure, Form } from '../shell/Page'
import { Table, TableBody, TableCell, TableRow } from '../ui/table'

// Work outside what was contracted, with the working exactly as it was measured on site. `LESS EXTRA WORK` in the workbooks was one figure with nothing behind it; this is the same figure with every line of it still there.

export type BillLineRow = {
  _id: string
  description: string
  working?: string
  quantity: number
  unit: string
  amountPaisa: number
}

export type BillRow = {
  _id: string
  raisedOn: string
  description: string
  totalPaisa: number
  lines: Array<BillLineRow>
}

export type TypedLine = { description: string; working: string; quantity: string; unit: string; ratePaisa: string }

export type RaisedBill = {
  raisedOn: string
  description: string
  lines: Array<{ description: string; working?: string; quantity: string; unit: string; ratePaisa: string }>
}

const anEmptyLine = (): TypedLine => ({ description: '', working: '', quantity: '', unit: '', ratePaisa: '' })

export function ExtraWork({
  bills,
  onRaise,
  onTakeBack,
}: {
  bills: Array<BillRow>
  onRaise: (bill: RaisedBill) => Promise<void>
  onTakeBack: (billId: string) => Promise<void>
}) {
  return (
    <section className="flex flex-col gap-5">
      <Heading>Work outside the contract</Heading>

      {bills.length === 0 ? (
        <p className="text-muted-foreground">None billed.</p>
      ) : (
        <ol aria-label="Bills already raised" className="flex flex-col gap-5">
          {bills.map((bill) => (
            <Bill key={bill._id} bill={bill} onTakeBack={onTakeBack} />
          ))}
        </ol>
      )}

      <RaiseOne onRaise={onRaise} />
    </section>
  )
}

function Bill({ bill, onTakeBack }: { bill: BillRow; onTakeBack: (billId: string) => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="text-foreground">{bill.description}</span>
        <Figure className="text-green text-lg">{formatPaisa(bill.totalPaisa)}</Figure>
      </div>

      {/* The lines under a bill, and the one table here that keeps shadcn's own `text-sm`: these are the working behind the figure above them rather than the reading itself. */}

      {/* No minimum width. At 390 a 30rem table cut `164 cft` in half under the edge of its own scroller, and a quantity cut in half reads as a smaller quantity. */}

      {/* Three columns rather than four, and the working on its own line under each of them. None of the four could go: the amount cannot be cut, because a sliced figure reads as a smaller figure; the quantity is the same; and the working cannot be dropped, because `39.75' x 0.375' x 11'` is nowhere else in this app -- not on the bill, not on the trade, not on the house. Nor can it wrap, because a measurement broken over two lines stops being one. Four things that will not fit and none that can go means the line needs more room down rather than fewer columns across. */}

      {/* At every width, not only on a phone. A working belongs under the line it explains rather than beside it, which is how a bill reads on paper -- and one shape at both widths is one shape to keep right. It needs no label the way the houses list did: nobody has to be told that `39.75' x 0.375' x 11'` is a measurement. */}
      <Table>
        <TableBody>
          {bill.lines.map((line) => (
            <Fragment key={line._id}>
              <TableRow className={line.working === undefined ? undefined : 'border-b-0'}>
                {/* What the work was, in his words, so it wraps. */}
                <TableCell className="text-muted-foreground py-2 pr-4 whitespace-normal">{line.description}</TableCell>
                <TableCell className="py-2 pr-4 text-right">
                  <Figure className="text-muted-foreground">
                    {line.quantity} {line.unit}
                  </Figure>
                </TableCell>
                <TableCell className="py-2 text-right">
                  <Figure className="text-foreground">{formatPaisa(line.amountPaisa)}</Figure>
                </TableCell>
              </TableRow>

              {/* The working exactly as it was measured on site, and only when there is one: a line without it must not leave an empty row behind. */}
              {line.working === undefined ? null : (
                <TableRow>
                  <TableCell colSpan={3} className="pt-0 pb-2">
                    <Figure className="text-faint">{line.working}</Figure>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-baseline gap-4">
        <span className="text-faint text-sm">Raised {bill.raisedOn}</span>
        <WayOut
          busy={saving}
          onClick={() => {
            setSaving(true)
            setRefusal(null)
            void onTakeBack(bill._id)
              .catch((thrown: unknown) => {
                setRefusal(whatWentWrong(thrown))
              })
              .finally(() => {
                setSaving(false)
              })
          }}
        >
          {saving ? 'Taking it back…' : 'Take it back'}
        </WayOut>
        {refusal === null ? null : (
          <span role="alert" className="text-destructive text-sm">
            {refusal}
          </span>
        )}
      </div>
    </li>
  )
}

// A bill and its lines land together or not at all: a bill with no lines is a figure with nothing behind it, which is the thing this replaces.
function RaiseOne({ onRaise }: { onRaise: (bill: RaisedBill) => Promise<void> }) {
  const [raisedOn, setRaisedOn] = useState(todayOnThisDevice)
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<Array<TypedLine>>([anEmptyLine()])
  const [saving, setSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [raised, setRaised] = useState(0)

  function change(at: number, what: Partial<TypedLine>) {
    setLines((before) => before.map((line, index) => (index === at ? { ...line, ...what } : line)))
  }

  async function raise() {
    setSaving(true)
    setRefusal(null)

    try {
      await onRaise({
        raisedOn,
        description,
        lines: lines.map((line) => ({ ...line, working: line.working.trim() === '' ? undefined : line.working })),
      })
      setDescription('')
      setLines([anEmptyLine()])
      setRaised((before) => before + 1)
    } catch (thrown) {
      setRefusal(whatWentWrong(thrown))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form className="border-border gap-5 rounded-md border p-4" freshAfter={raised}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <Field
          label="What the work was"
          hint="The way you would say it to him."
          problem={whatIsWrong(extraWorkBillInput.shape.description, description)}
        >
          <Line
            value={description}
            onChange={(event) => {
              setDescription(event.target.value)
            }}
            autoComplete="off"
            aria-label="What the work was"
          />
        </Field>

        <Day label="Raised on" problem={whatIsWrong(calendarDay, raisedOn)} value={raisedOn} onPick={setRaisedOn} />
      </div>

      <ol aria-label="The lines of this bill" className="flex flex-col gap-5">
        {lines.map((line, at) => (
          <TypeALine
            key={at}
            at={at}
            line={line}
            onChange={change}
            onTakeOff={
              lines.length === 1
                ? undefined
                : () => {
                    setLines((before) => before.filter((_, index) => index !== at))
                  }
            }
          />
        ))}
      </ol>

      <button
        type="button"
        onClick={() => {
          setLines((before) => [...before, anEmptyLine()])
        }}
        className="text-primary self-start text-sm font-medium"
      >
        Add a line
      </button>

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-faint text-sm">
          {/* Adding up as it is typed, so nobody raises a bill without seeing the figure the client is about to be sent. */}
          Comes to <Figure className="text-green">{formatPaisa(whatItComesTo(lines))}</Figure>
        </span>
      </div>

      {refusal === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {refusal}
        </p>
      )}

      <div>
        <Button onClick={raise} busy={saving} className="py-2 text-sm">
          Raise the bill
        </Button>
      </div>
    </Form>
  )
}

function TypeALine({
  at,
  line,
  onChange,
  onTakeOff,
}: {
  at: number
  line: TypedLine
  onChange: (at: number, what: Partial<TypedLine>) => void
  onTakeOff?: () => void
}) {
  const said = (what: string) => `${what} on line ${at + 1}`

  return (
    <li className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="What it was" problem={whatIsWrong(extraWorkLineInput.shape.description, line.description)}>
          <Line
            value={line.description}
            onChange={(event) => {
              onChange(at, { description: event.target.value })
            }}
            autoComplete="off"
            aria-label={said('What it was')}
          />
        </Field>

        {/* Left exactly as written. `39.75' x 0.375' x 11'` is how the man on site worked it out, and re-deriving it would only ever disagree with him. */}
        <Field label="How it was worked out" hint="Optional, exactly as it was measured.">
          <Line
            value={line.working}
            onChange={(event) => {
              onChange(at, { working: event.target.value })
            }}
            autoComplete="off"
            aria-label={said('How it was worked out')}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="How much of it" problem={whatIsWrong(extraWorkLineInput.shape.quantity, line.quantity)}>
          <Line
            value={line.quantity}
            onChange={(event) => {
              onChange(at, { quantity: groupWhileTyping(event.target.value) })
            }}
            inputMode="decimal"
            autoComplete="off"
            aria-label={said('How much of it')}
          />
        </Field>

        <Field label="Measured in" problem={whatIsWrong(extraWorkLineInput.shape.unit, line.unit)}>
          <Line
            value={line.unit}
            onChange={(event) => {
              onChange(at, { unit: event.target.value })
            }}
            autoComplete="off"
            placeholder="cft"
            aria-label={said('Measured in')}
          />
        </Field>

        <Field label="Rate" problem={whatIsWrong(positiveMoney, line.ratePaisa)}>
          <Line
            value={line.ratePaisa}
            onChange={(event) => {
              onChange(at, { ratePaisa: groupWhileTyping(event.target.value) })
            }}
            inputMode="decimal"
            autoComplete="off"
            aria-label={said('Rate')}
          />
        </Field>
      </div>

      {onTakeOff === undefined ? null : (
        <WayOut onClick={onTakeOff} className="self-start">
          Take this line off
        </WayOut>
      )}
    </li>
  )
}

// The same arithmetic the server does, on what has been typed so far. A line that is not a line yet counts as nothing rather than stopping the total.
export function whatItComesTo(lines: Array<TypedLine>): number {
  return lines.reduce((total, line) => {
    const read = extraWorkLineInput.safeParse({ ...line, working: undefined })

    return read.success ? total + lineAmountPaisa(read.data) : total
  }, 0)
}

function Heading({ children }: { children: string }) {
  return <h2 className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">{children}</h2>
}
