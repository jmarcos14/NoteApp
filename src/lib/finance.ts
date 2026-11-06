import type { Account, CreditCard, Transaction, Budget, Category } from '../types'
import { addMonths, isoDate, monthKey } from './utils'

/** Saldo de uma conta até (inclusive) uma data */
export function accountBalance(acc: Account, txs: Transaction[], until?: string) {
  let bal = acc.initialBalance
  for (const t of txs) {
    if (until && t.date > until) continue
    if (t.type === 'income' && t.accountId === acc.id) bal += t.amount
    else if (t.type === 'expense' && t.accountId === acc.id && !t.cardId) bal -= t.amount
    else if (t.type === 'transfer') {
      if (t.accountId === acc.id) bal -= t.amount
      if (t.toAccountId === acc.id) bal += t.amount
    }
  }
  return bal
}

/** Dívida total do cartão (compras - pagamentos) até uma data */
export function cardDebt(card: CreditCard, txs: Transaction[], until?: string) {
  let debt = 0
  for (const t of txs) {
    if (until && t.date > until) continue
    if (t.type === 'expense' && t.cardId === card.id) debt += t.amount
    if (t.type === 'transfer' && t.toCardId === card.id) debt -= t.amount
  }
  return debt
}

/** Período da fatura atual (fechamento → fechamento) */
export function currentInvoicePeriod(card: CreditCard, today = new Date()) {
  const d = today.getDate()
  const y = today.getFullYear()
  const m = today.getMonth()
  // se já passou do fechamento, a fatura aberta fecha no mês seguinte
  const closeMonth = d > card.closingDay ? m + 1 : m
  const close = new Date(y, closeMonth, card.closingDay)
  const open = new Date(y, closeMonth - 1, card.closingDay + 1)
  const due = new Date(y, closeMonth + (card.dueDay <= card.closingDay ? 1 : 0), card.dueDay)
  return { start: isoDate(open), end: isoDate(close), due: isoDate(due) }
}

export function invoiceAmount(card: CreditCard, txs: Transaction[], today = new Date()) {
  const { start, end } = currentInvoicePeriod(card, today)
  return txs
    .filter((t) => t.type === 'expense' && t.cardId === card.id && t.date >= start && t.date <= end)
    .reduce((s, t) => s + t.amount, 0)
}

export function monthTotals(txs: Transaction[], month: string) {
  let income = 0
  let expense = 0
  for (const t of txs) {
    if (monthKey(t.date) !== month) continue
    if (t.type === 'income') income += t.amount
    if (t.type === 'expense') expense += t.amount
  }
  return { income, expense, net: income - expense }
}

export function expensesByCategory(txs: Transaction[], month: string) {
  const map = new Map<string, number>()
  for (const t of txs) {
    if (t.type !== 'expense' || monthKey(t.date) !== month) continue
    const k = t.categoryId ?? 'uncategorized'
    map.set(k, (map.get(k) ?? 0) + t.amount)
  }
  return map
}

export function cashFlowSeries(txs: Transaction[], months: number, endMonth = monthKey(new Date())) {
  const out: { month: string; income: number; expense: number; net: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const m = addMonths(endMonth, -i)
    out.push({ month: m, ...monthTotals(txs, m) })
  }
  return out
}

const lastDayOfMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return isoDate(new Date(y, m, 0))
}

/** Evolução do patrimônio líquido (contas - dívidas de cartão) no fim de cada mês */
export function netWorthSeries(
  accounts: Account[],
  cards: CreditCard[],
  txs: Transaction[],
  months: number,
  endMonth = monthKey(new Date()),
) {
  const out: { month: string; assets: number; debts: number; netWorth: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const m = addMonths(endMonth, -i)
    const until = lastDayOfMonth(m)
    const assets = accounts.reduce((s, a) => s + accountBalance(a, txs, until), 0)
    const debts = cards.reduce((s, c) => s + cardDebt(c, txs, until), 0)
    out.push({ month: m, assets, debts, netWorth: assets - debts })
  }
  return out
}

export function budgetProgress(budgets: Budget[], categories: Category[], txs: Transaction[], month: string) {
  const spent = expensesByCategory(txs, month)
  return budgets
    .map((b) => {
      const cat = categories.find((c) => c.id === b.categoryId)
      const used = spent.get(b.categoryId) ?? 0
      return { budget: b, category: cat, used, pct: b.limit > 0 ? used / b.limit : 0 }
    })
    .filter((x) => x.category)
    .sort((a, b) => b.pct - a.pct)
}

export const ACCOUNT_TYPE_LABEL: Record<Account['type'], string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  cash: 'Dinheiro',
  investment: 'Investimentos',
}
