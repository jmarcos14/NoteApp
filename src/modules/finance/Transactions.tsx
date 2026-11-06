import { useMemo, useState } from 'react'
import { Search, Receipt } from 'lucide-react'
import { EmptyState, Money } from '../../components/ui'
import { useFinance } from '../../store/finance'
import { useFinanceCtx } from './FinanceLayout'
import TransactionItem from './TransactionItem'
import { cn, monthKey } from '../../lib/utils'
import type { TransactionType } from '../../types'

export default function TransactionsPage() {
  const { month, openQuickAdd } = useFinanceCtx()
  const { transactions, categories, accounts, cards } = useFinance()
  const [q, setQ] = useState('')
  const [type, setType] = useState<TransactionType | 'all'>('all')
  const [cat, setCat] = useState<string>('')
  const [src, setSrc] = useState<string>('')

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = transactions
      .filter((t) => monthKey(t.date) === month)
      .filter((t) => type === 'all' || t.type === type)
      .filter((t) => !cat || t.categoryId === cat)
      .filter((t) => !src || t.accountId === src || t.cardId === src || t.toAccountId === src || t.toCardId === src)
      .filter((t) => !term || t.description.toLowerCase().includes(term))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    const byDay = new Map<string, typeof list>()
    for (const t of list) byDay.set(t.date, [...(byDay.get(t.date) ?? []), t])
    const total = list.reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0)
    return { byDay: [...byDay.entries()], total, count: list.length }
  }, [transactions, month, q, type, cat, src])

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar transações…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {(['all', 'expense', 'income', 'transfer'] as const).map((t) => (
          <button key={t} className={cn('chip', type === t && 'chip-active')} onClick={() => setType(t)}>
            {{ all: 'Todas', expense: 'Despesas', income: 'Receitas', transfer: 'Transferências' }[t]}
          </button>
        ))}
        <select className="chip bg-transparent" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filtrar categoria">
          <option value="">Categoria</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
        <select className="chip bg-transparent" value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Filtrar conta">
          <option value="">Conta/cartão</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          {cards.map((c) => <option key={c.id} value={c.id}>💳 {c.name}</option>)}
        </select>
      </div>

      <div className="flex justify-between px-1 text-xs text-slate-500">
        <span>{groups.count} transações</span>
        <span>Saldo do filtro: <Money value={groups.total} signed className="font-semibold" /></span>
      </div>

      {groups.count === 0 ? (
        <EmptyState icon={<Receipt />} title="Nada por aqui" text="Use o botão + para lançar uma transação rapidamente." />
      ) : (
        groups.byDay.map(([day, list]) => (
          <section key={day}>
            <h3 className="mb-1 px-1 text-xs font-semibold text-slate-500">
              {new Date(day + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </h3>
            <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-white/5">
              {list.map((t) => <TransactionItem key={t.id} t={t} onClick={() => openQuickAdd(t)} />)}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
