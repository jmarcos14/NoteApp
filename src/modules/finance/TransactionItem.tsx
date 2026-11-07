import { ArrowLeftRight, CreditCard } from 'lucide-react'
import { Money } from '../../components/ui'
import { useFinance } from '../../store/finance'
import { dateLabel } from '../../lib/utils'
import type { Transaction } from '../../types'

export default function TransactionItem({ t, onClick }: { t: Transaction; onClick?: () => void }) {
  const { categories, accounts, cards } = useFinance()
  const cat = categories.find((c) => c.id === t.categoryId)
  const acc = accounts.find((a) => a.id === t.accountId)
  const card = cards.find((c) => c.id === t.cardId)
  const toAcc = accounts.find((a) => a.id === t.toAccountId)
  const toCard = cards.find((c) => c.id === t.toCardId)

  const sub =
    t.type === 'transfer'
      ? `${acc?.name ?? '?'} → ${toAcc?.name ?? (toCard ? `Fatura ${toCard.name}` : '?')}`
      : [cat?.name, card ? `💳 ${card.name}` : acc?.name].filter(Boolean).join(' · ')

  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-white/[.03] dark:active:bg-white/5">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ background: (cat?.color ?? '#6366f1') + '22' }}
      >
        {t.type === 'transfer' ? <ArrowLeftRight size={18} className="text-brand-500" /> : (cat?.emoji ?? (card ? <CreditCard size={18} /> : '💸'))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{t.description}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{sub}</p>
      </div>
      <div className="text-right">
        <Money
          value={t.type === 'expense' ? -t.amount : t.amount}
          signed={t.type === 'income'}
          className={
            t.type === 'income' ? 'text-sm font-semibold text-emerald-600 dark:text-emerald-400'
              : t.type === 'expense' ? 'text-sm font-semibold' : 'text-sm font-semibold text-slate-500'
          }
        />
        <p className="text-[11px] text-slate-400">{dateLabel(t.date)}</p>
      </div>
    </button>
  )
}
