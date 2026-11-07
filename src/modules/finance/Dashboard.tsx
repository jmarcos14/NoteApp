import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, ChevronRight, CreditCard } from 'lucide-react'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { Money, ProgressBar, SectionTitle } from '../../components/ui'
import { useFinance } from '../../store/finance'
import { useFinanceCtx } from './FinanceLayout'
import TransactionItem from './TransactionItem'
import {
  ACCOUNT_TYPE_LABEL, accountBalance, budgetProgress, cardDebt, cashFlowSeries, currentInvoicePeriod,
  expensesByCategory, invoiceAmount, monthTotals,
} from '../../lib/finance'
import { dateLabel, money, monthKey, monthLabel } from '../../lib/utils'
import { ChartTooltip, useChartTheme } from './chartTheme'

export default function FinanceDashboard() {
  const { month, openQuickAdd } = useFinanceCtx()
  const { accounts, cards, transactions, categories, budgets } = useFinance()
  const chart = useChartTheme()

  const data = useMemo(() => {
    const totals = monthTotals(transactions, month)
    const balances = accounts.map((a) => ({ acc: a, balance: accountBalance(a, transactions) }))
    const assets = balances.reduce((s, b) => s + b.balance, 0)
    const debts = cards.reduce((s, c) => s + cardDebt(c, transactions), 0)
    const flow = cashFlowSeries(transactions, 6, month).map((f) => ({ ...f, label: monthLabel(f.month, { month: 'short' }).replace('.', '') }))
    const byCat = [...expensesByCategory(transactions, month).entries()]
      .map(([id, value]) => {
        const c = categories.find((x) => x.id === id)
        return { id, name: c?.name ?? 'Sem categoria', emoji: c?.emoji ?? '❔', color: c?.color ?? '#94a3b8', value }
      })
      .sort((a, b) => b.value - a.value)
    const budget = budgetProgress(budgets, categories, transactions, month)
    const recent = [...transactions]
      .filter((t) => monthKey(t.date) === month)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
      .slice(0, 6)
    return { totals, balances, assets, debts, flow, byCat, budget, recent }
  }, [accounts, cards, transactions, categories, budgets, month])

  const savingsRate = data.totals.income > 0 ? data.totals.net / data.totals.income : 0

  return (
    <div className="space-y-4">
      {/* Saldo / patrimônio */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-indigo-600 to-violet-700 p-5 text-white shadow-lg shadow-brand-600/20">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <p className="text-sm text-white/70">Saldo em contas</p>
        <Money value={data.assets} className="block text-3xl font-bold tracking-tight" />
        <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-white/70">
          <span>Faturas: <Money value={-data.debts} /></span>
          <span>Patrimônio líquido: <Money value={data.assets - data.debts} className="font-semibold text-white" /></span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
            <div className="flex items-center gap-1 text-xs text-white/70"><ArrowUpRight size={14} /> Receitas</div>
            <Money value={data.totals.income} className="text-lg font-semibold" />
          </div>
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
            <div className="flex items-center gap-1 text-xs text-white/70"><ArrowDownRight size={14} /> Despesas</div>
            <Money value={data.totals.expense} className="text-lg font-semibold" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-white/70">Resultado de {monthLabel(month, { month: 'long' })}</span>
          <span className="font-semibold">
            <Money value={data.totals.net} signed /> {data.totals.income > 0 && <span className="text-xs text-white/70">({Math.round(savingsRate * 100)}% poupado)</span>}
          </span>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Fluxo de caixa mini */}
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Fluxo de caixa</h3>
            <Link to="/finance/reports" className="text-xs text-brand-500">Ver gráficos</Link>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.flow} barGap={2}>
                <XAxis dataKey="label" tick={{ fill: chart.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: chart.cursor }} />
                <Bar dataKey="income" name="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Despesas por categoria */}
        <section className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">Despesas por categoria</h3>
          {data.byCat.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Sem despesas neste mês</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-32 w-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.byCat} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
                      {data.byCat.map((c) => <Cell key={c.id} fill={c.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                {data.byCat.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="flex-1 truncate">{c.emoji} {c.name}</span>
                    <Money value={c.value} className="text-xs text-slate-500" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* Contas */}
      <SectionTitle action={<Link to="/finance/accounts" className="text-xs text-brand-500">Gerenciar</Link>}>Contas</SectionTitle>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {data.balances.map(({ acc, balance }) => (
          <div key={acc.id} className="card min-w-44 snap-start p-3">
            <div className="mb-2 h-1.5 w-8 rounded-full" style={{ background: acc.color }} />
            <p className="truncate text-sm font-medium">{acc.name}</p>
            <p className="text-[11px] text-slate-500">{ACCOUNT_TYPE_LABEL[acc.type]}</p>
            <Money value={balance} className="mt-1 block font-semibold" />
          </div>
        ))}
      </div>

      {/* Cartões */}
      {cards.length > 0 && (
        <>
          <SectionTitle>Cartões de crédito</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {cards.map((c) => {
              const inv = invoiceAmount(c, transactions)
              const debt = cardDebt(c, transactions)
              const period = currentInvoicePeriod(c)
              return (
                <div key={c.id} className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-12 items-center justify-center rounded-lg text-white" style={{ background: c.color }}>
                      <CreditCard size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-[11px] text-slate-500">Fecha {dateLabel(period.end)} · vence {dateLabel(period.due)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-500">Fatura atual</p>
                      <Money value={inv} className="font-semibold" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <ProgressBar pct={debt / c.limit} color={c.color === '#1e293b' ? '#6366f1' : c.color} />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Limite disponível: <Money value={c.limit - debt} /> de {money(c.limit)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Orçamentos */}
      {data.budget.length > 0 && (
        <>
          <SectionTitle action={<Link to="/finance/budgets" className="text-xs text-brand-500">Ver todos</Link>}>Orçamentos</SectionTitle>
          <div className="card space-y-3 p-4">
            {data.budget.slice(0, 4).map(({ budget, category, used, pct }) => (
              <div key={budget.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{category!.emoji} {category!.name}</span>
                  <span className="text-xs text-slate-500"><Money value={used} /> / <Money value={budget.limit} /></span>
                </div>
                <ProgressBar pct={pct} color={category!.color} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recentes */}
      <SectionTitle action={<Link to="/finance/transactions" className="flex items-center text-xs text-brand-500">Todas <ChevronRight size={14} /></Link>}>
        Transações recentes
      </SectionTitle>
      <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-white/5">
        {data.recent.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Nenhuma transação neste mês</p>}
        {data.recent.map((t) => <TransactionItem key={t.id} t={t} onClick={() => openQuickAdd(t)} />)}
      </div>
    </div>
  )
}
