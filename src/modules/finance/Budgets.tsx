import { useMemo, useState } from 'react'
import { Plus, Target } from 'lucide-react'
import { ColorPicker, Money, ProgressBar, SectionTitle, Segmented, Sheet, confirmAction } from '../../components/ui'
import { useFinance } from '../../store/finance'
import { expensesByCategory } from '../../lib/finance'
import { PALETTE, cn, monthLabel } from '../../lib/utils'
import { useFinanceCtx } from './FinanceLayout'
import type { Category, CategoryKind } from '../../types'

export default function BudgetsPage() {
  const { month } = useFinanceCtx()
  const { categories, budgets, transactions, setBudget, deleteBudget } = useFinance()
  const [editing, setEditing] = useState<Category | null>(null)
  const [catSheet, setCatSheet] = useState<Partial<Category> | null>(null)
  const [limit, setLimit] = useState('')

  const rows = useMemo(() => {
    const spent = expensesByCategory(transactions, month)
    return categories
      .filter((c) => c.kind === 'expense')
      .map((c) => {
        const b = budgets.find((x) => x.categoryId === c.id)
        const used = spent.get(c.id) ?? 0
        return { c, b, used, pct: b && b.limit > 0 ? used / b.limit : 0 }
      })
      .sort((a, b) => Number(!!b.b) - Number(!!a.b) || b.pct - a.pct || b.used - a.used)
  }, [categories, budgets, transactions, month])

  const totalLimit = rows.reduce((s, r) => s + (r.b?.limit ?? 0), 0)
  const totalUsed = rows.filter((r) => r.b).reduce((s, r) => s + r.used, 0)

  const open = (c: Category) => {
    setEditing(c)
    setLimit(String(budgets.find((b) => b.categoryId === c.id)?.limit ?? ''))
  }

  return (
    <div>
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Orçado em {monthLabel(month, { month: 'long' })}</p>
            <p className="text-lg font-bold"><Money value={totalUsed} /> <span className="text-sm font-normal text-slate-500">de <Money value={totalLimit} /></span></p>
          </div>
          <div className={cn('rounded-full px-3 py-1 text-xs font-semibold', totalUsed > totalLimit ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')}>
            {totalLimit > 0 ? `${Math.round((totalUsed / totalLimit) * 100)}%` : '—'}
          </div>
        </div>
        <div className="mt-3"><ProgressBar pct={totalLimit ? totalUsed / totalLimit : 0} /></div>
        <p className="mt-2 text-xs text-slate-500">
          Restante: <Money value={Math.max(0, totalLimit - totalUsed)} />
        </p>
      </div>

      <SectionTitle action={<button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setCatSheet({ kind: 'expense' })}><Plus size={14} /> Categoria</button>}>
        Por categoria
      </SectionTitle>
      <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-white/5">
        {rows.map(({ c, b, used, pct }) => (
          <button key={c.id} className="block w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-white/[.03]" onClick={() => open(c)}>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg" style={{ background: c.color + '22' }}>{c.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{c.name}</span>
                  {b ? (
                    <span className={cn('text-xs', pct > 1 ? 'font-semibold text-red-500' : 'text-slate-500')}>
                      <Money value={used} /> / <Money value={b.limit} />
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400"><Money value={used} /> · definir limite</span>
                  )}
                </div>
                {b && <div className="mt-1.5"><ProgressBar pct={pct} color={c.color} /></div>}
                {b && pct > 1 && <p className="mt-1 text-[11px] text-red-500">Estourou em <Money value={used - b.limit} /></p>}
              </div>
            </div>
          </button>
        ))}
      </div>

      <SectionTitle action={<button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setCatSheet({ kind: 'income' })}><Plus size={14} /> Categoria</button>}>
        Categorias de receita
      </SectionTitle>
      <div className="flex flex-wrap gap-2">
        {categories.filter((c) => c.kind === 'income').map((c) => (
          <button key={c.id} className="chip" onClick={() => setCatSheet(c)}>{c.emoji} {c.name}</button>
        ))}
      </div>

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `${editing.emoji} ${editing.name}` : ''}
        footer={
          <div className="flex gap-2">
            {editing && budgets.some((b) => b.categoryId === editing.id) && (
              <button className="btn-danger" onClick={() => { deleteBudget(budgets.find((b) => b.categoryId === editing.id)!.id); setEditing(null) }}>Remover limite</button>
            )}
            <button className="btn-ghost" onClick={() => { setCatSheet(editing!); setEditing(null) }}>Editar categoria</button>
            <button className="btn-primary flex-1" onClick={() => { const v = Number(limit.replace(',', '.')); if (v > 0) setBudget(editing!.id, v); setEditing(null) }}>Salvar</button>
          </div>
        }
      >
        <label className="label">Limite mensal (R$)</label>
        <div className="relative">
          <Target size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" inputMode="decimal" autoFocus value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Ex.: 500" />
        </div>
      </Sheet>

      {catSheet && <CategorySheet value={catSheet} onClose={() => setCatSheet(null)} />}
    </div>
  )
}

const EMOJIS = ['🏠', '🍽️', '🛒', '🚗', '💊', '🎬', '📺', '📚', '✈️', '🐶', '👕', '🎁', '💼', '📈', '🧑‍💻', '💰', '⚡', '🏋️']

function CategorySheet({ value, onClose }: { value: Partial<Category>; onClose: () => void }) {
  const { upsertCategory, deleteCategory } = useFinance()
  const [form, setForm] = useState({
    name: value.name ?? '', kind: value.kind ?? ('expense' as CategoryKind),
    emoji: value.emoji ?? '💰', color: value.color ?? PALETTE[2],
  })
  return (
    <Sheet open onClose={onClose} title={value.id ? 'Editar categoria' : 'Nova categoria'}
      footer={
        <div className="flex gap-2">
          {value.id && <button className="btn-danger" onClick={() => { if (confirmAction('Excluir categoria?')) { deleteCategory(value.id!); onClose() } }}>Excluir</button>}
          <button className="btn-primary flex-1" onClick={() => { if (form.name.trim()) { upsertCategory({ id: value.id, ...form, name: form.name.trim() }); onClose() } }}>Salvar</button>
        </div>
      }>
      <div className="space-y-4">
        <Segmented value={form.kind} onChange={(kind) => setForm({ ...form, kind })} options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} />
        <div><label className="label">Nome</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div>
          <span className="label">Ícone</span>
          <div className="flex flex-wrap gap-1">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => setForm({ ...form, emoji: e })} className={cn('h-10 w-10 rounded-xl text-xl', form.emoji === e ? 'bg-brand-500/15 ring-2 ring-brand-500' : 'hover:bg-slate-100 dark:hover:bg-white/5')}>{e}</button>
            ))}
          </div>
        </div>
        <div><span className="label">Cor</span><ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} colors={PALETTE} /></div>
      </div>
    </Sheet>
  )
}
