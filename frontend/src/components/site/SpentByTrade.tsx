import { formatPaisa } from '~shared/money'

import { Figure } from '../shell/Page'

export type TradeSpend = { tradeId: string; name: string; paisa: number }

// A table rather than a list, and no width cap on it: this is the reason a desk is wider than a phone.
export function SpentByTrade({ byTrade }: { byTrade: Array<TradeSpend> }) {
  if (byTrade.length === 0) {
    return <p className="text-muted">Nothing spent on this house yet.</p>
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">What it went on</h2>

      {/* Scrolls inside itself rather than pushing the page sideways, which is what a narrow phone does to a table. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] border-collapse text-left">
          <tbody className="divide-hairline divide-y">
            {byTrade.map((trade) => (
              <tr key={trade.tradeId}>
                <td className="text-foreground py-2.5 pr-4">{trade.name}</td>
                {/* Brass is money going out. */}
                <td className="py-2.5 text-right">
                  <Figure className="text-brass">{formatPaisa(trade.paisa)}</Figure>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
