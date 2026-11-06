import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Account, Budget, Category, CreditCard, Transaction } from '../types'
import { uid } from '../lib/utils'
import { seedFinance } from './seed'

type Draft<T> = Omit<T, 'id' | 'createdAt'>

interface FinanceState {
  accounts: Account[]
  cards: CreditCard[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]

  addTransaction: (t: Draft<Transaction>) => void
  updateTransaction: (id: string, patch: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void

  upsertAccount: (a: Partial<Account> & Omit<Account, 'id'>) => void
  deleteAccount: (id: string) => void
  upsertCard: (c: Partial<CreditCard> & Omit<CreditCard, 'id'>) => void
  deleteCard: (id: string) => void
  upsertCategory: (c: Partial<Category> & Omit<Category, 'id'>) => void
  deleteCategory: (id: string) => void
  setBudget: (categoryId: string, limit: number) => void
  deleteBudget: (id: string) => void
  reset: () => void
}

function upsert<T extends { id: string }>(list: T[], item: Partial<T> & Omit<T, 'id'>): T[] {
  if (item.id && list.some((x) => x.id === item.id)) {
    return list.map((x) => (x.id === item.id ? ({ ...x, ...item } as T) : x))
  }
  return [...list, { ...item, id: item.id ?? uid() } as T]
}

export const useFinance = create<FinanceState>()(
  persist(
    (set) => ({
      ...seedFinance(),

      addTransaction: (t) =>
        set((s) => ({ transactions: [{ ...t, id: uid(), createdAt: Date.now() }, ...s.transactions] })),
      updateTransaction: (id, patch) =>
        set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTransaction: (id) => set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

      upsertAccount: (a) => set((s) => ({ accounts: upsert(s.accounts, a) })),
      deleteAccount: (id) =>
        set((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
          transactions: s.transactions.filter((t) => t.accountId !== id && t.toAccountId !== id),
        })),
      upsertCard: (c) => set((s) => ({ cards: upsert(s.cards, c) })),
      deleteCard: (id) =>
        set((s) => ({
          cards: s.cards.filter((c) => c.id !== id),
          transactions: s.transactions.filter((t) => t.cardId !== id && t.toCardId !== id),
        })),
      upsertCategory: (c) => set((s) => ({ categories: upsert(s.categories, c) })),
      deleteCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          budgets: s.budgets.filter((b) => b.categoryId !== id),
          transactions: s.transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: undefined } : t)),
        })),
      setBudget: (categoryId, limit) =>
        set((s) => {
          const existing = s.budgets.find((b) => b.categoryId === categoryId)
          if (existing) return { budgets: s.budgets.map((b) => (b.id === existing.id ? { ...b, limit } : b)) }
          return { budgets: [...s.budgets, { id: uid(), categoryId, limit }] }
        }),
      deleteBudget: (id) => set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) })),
      reset: () => set(seedFinance()),
    }),
    { name: 'noteapp-finance', version: 1 },
  ),
)
