import { useMemo, useState } from 'react'
import {
  Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Money, Segmented } from '../../components/ui'
import { useFinance } from '../../store/finance'
import { cashFlowSeries, netWorthSeries } from '../../lib/finance'
import { compactNumber, monthLabel } from '../../lib/utils'
import { useSettings } from '../../store/settings'
import { useFinanceCtx } from './FinanceLayout'
import { ChartTooltip, useChartTheme } from './chartTheme'

export default function ReportsPage() {
  const { month } = useFinanceCtx()
  const { accounts, cards, transactions } = useFinance()
  const hide = useSettings((s) => s.hideValues)
  const chart = useChartTheme()
  const [range, setRange] = useState<'6' | '12'>('6')
  const n = Number(range)

  const flow = useMemo(
    () => cashFlowSeries(transactions, n, month).map((f) => ({ ...f, label: monthLabel(f.month, { month: 'short' }).replace('.', '') })),
    [transactions, n, month],
  )
  const worth = useMemo(
    () => netWorthSeries(accounts, cards, transactions, n, month).map((f) => ({ ...f, label: monthLabel(f.month, { month: 'short' }).replace('.', '') })),
    [accounts, cards, transactions, n, month],
  )

  const avgIncome = flow.reduce((s, f) => s + f.income, 0) / n
  const avgExpense = flow.reduce((s, f) => s + f.expense, 0) / n
  const first = worth[0]?.netWorth ?? 0
  const last = worth[worth.length - 1]?.netWorth ?? 0
  const growth = first !== 0 ? (last - first) / Math.abs(first) : 0
  const yTick = (v: number) => (hide ? '' : compactNumber(v))

  return (
    <div className="space-y-4">
      <Segmented value={range} onChange={setRange} options={[{ value: '6', label: '6 meses' }, { value: '12', label: '12 meses' }]} />

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3"><p className="text-[11px] text-slate-500">Receita média</p><Money value={avgIncome} className="text-sm font-semibold text-emerald-600 dark:text-emerald-400" /></div>
        <div className="card p-3"><p className="text-[11px] text-slate-500">Despesa média</p><Money value={avgExpense} className="text-sm font-semibold text-rose-500" /></div>
        <div className="card p-3"><p className="text-[11px] text-slate-500">Patrimônio</p><p className={`text-sm font-semibold ${growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>{growth >= 0 ? '▲' : '▼'} {Math.abs(growth * 100).toFixed(1)}%</p></div>
      </div>

      <section className="card p-4">
        <h3 className="text-sm font-semibold">Fluxo de caixa</h3>
        <p className="mb-3 text-xs text-slate-500">Receitas × despesas e resultado mensal</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={flow} margin={{ left: 0, right: 4 }}>
              <CartesianGrid vertical={false} stroke={chart.grid} />
              <XAxis dataKey="label" tick={{ fill: chart.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={yTick} tick={{ fill: chart.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: chart.cursor }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="expense" name="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Line dataKey="net" name="Resultado" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} type="monotone" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card p-4">
        <h3 className="text-sm font-semibold">Evolução do patrimônio</h3>
        <p className="mb-3 text-xs text-slate-500">Saldo em contas menos dívidas de cartão, no fim de cada mês</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={worth} margin={{ left: 0, right: 4 }}>
              <defs>
                <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={chart.grid} />
              <XAxis dataKey="label" tick={{ fill: chart.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={yTick} tick={{ fill: chart.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={52} domain={['auto', 'auto']} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area dataKey="netWorth" name="Patrimônio líquido" stroke="#6366f1" strokeWidth={2.5} fill="url(#nw)" type="monotone" />
              <Line dataKey="debts" name="Dívidas" stroke="#f43f5e" strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
