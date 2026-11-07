import { useState } from 'react'
import { CreditCard as CardIcon, Landmark, Pencil, Plus } from 'lucide-react'
import { ColorPicker, Money, ProgressBar, SectionTitle, Sheet, confirmAction } from '../../components/ui'
import { useFinance } from '../../store/finance'
import { ACCOUNT_TYPE_LABEL, accountBalance, cardDebt, currentInvoicePeriod, invoiceAmount } from '../../lib/finance'
import { PALETTE, dateLabel } from '../../lib/utils'
import { useFinanceCtx } from './FinanceLayout'
import type { Account, AccountType, CreditCard } from '../../types'

export default function AccountsPage() {
  const { accounts, cards, transactions } = useFinance()
  const { openQuickAdd } = useFinanceCtx()
  const [accSheet, setAccSheet] = useState<Partial<Account> | null>(null)
  const [cardSheet, setCardSheet] = useState<Partial<CreditCard> | null>(null)

  const total = accounts.reduce((s, a) => s + accountBalance(a, transactions), 0)
  const debts = cards.reduce((s, c) => s + cardDebt(c, transactions), 0)

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-slate-500">Total em contas</p>
          <Money value={total} className="text-lg font-bold" />
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Dívida em cartões</p>
          <Money value={debts} className="text-lg font-bold text-red-500" />
        </div>
      </div>

      <SectionTitle action={<button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setAccSheet({})}><Plus size={14} /> Conta</button>}>
        Contas
      </SectionTitle>
      <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-white/5">
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: a.color }}>
              <Landmark size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.name}</p>
              <p className="text-xs text-slate-500">{ACCOUNT_TYPE_LABEL[a.type]}</p>
            </div>
            <Money value={accountBalance(a, transactions)} className="font-semibold" />
            <button className="icon-btn" onClick={() => setAccSheet(a)} aria-label={`Editar ${a.name}`}><Pencil size={16} /></button>
          </div>
        ))}
        {accounts.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Cadastre sua primeira conta.</p>}
      </div>

      <SectionTitle action={<button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setCardSheet({})}><Plus size={14} /> Cartão</button>}>
        Cartões de crédito
      </SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const debt = cardDebt(c, transactions)
          const inv = invoiceAmount(c, transactions)
          const p = currentInvoicePeriod(c)
          return (
            <div key={c.id} className="overflow-hidden rounded-2xl text-white shadow-md" style={{ background: `linear-gradient(135deg, ${c.color}, ${c.color}cc)` }}>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-white/70">Fecha dia {c.closingDay} · vence dia {c.dueDay}</p>
                  </div>
                  <button className="rounded-lg p-1.5 hover:bg-white/10" onClick={() => setCardSheet(c)} aria-label={`Editar ${c.name}`}><Pencil size={16} /></button>
                </div>
                <p className="mt-4 text-xs text-white/70">Fatura atual ({dateLabel(p.start)} – {dateLabel(p.end)})</p>
                <Money value={inv} className="text-2xl font-bold" />
                <div className="mt-3 [&>div]:bg-white/20">
                  <ProgressBar pct={debt / c.limit} color="#ffffff" />
                </div>
                <div className="mt-1 flex justify-between text-xs text-white/80">
                  <span>Usado <Money value={debt} /></span>
                  <span>Limite <Money value={c.limit} /></span>
                </div>
              </div>
              <button
                className="w-full bg-black/15 py-2.5 text-sm font-medium hover:bg-black/25"
                onClick={() => openQuickAdd(undefined, { type: 'transfer', toCardId: c.id, description: `Pagamento fatura ${c.name}` })}
              >
                Pagar fatura
              </button>
            </div>
          )
        })}
      </div>

      {accSheet && <AccountSheet value={accSheet} onClose={() => setAccSheet(null)} />}
      {cardSheet && <CardSheet value={cardSheet} onClose={() => setCardSheet(null)} />}
    </div>
  )
}

function AccountSheet({ value, onClose }: { value: Partial<Account>; onClose: () => void }) {
  const { upsertAccount, deleteAccount } = useFinance()
  const [form, setForm] = useState({
    name: value.name ?? '', type: value.type ?? ('checking' as AccountType),
    initialBalance: String(value.initialBalance ?? 0), color: value.color ?? PALETTE[0],
  })
  const save = () => {
    if (!form.name.trim()) return
    upsertAccount({ id: value.id, name: form.name.trim(), type: form.type, initialBalance: Number(form.initialBalance.replace(',', '.')) || 0, color: form.color })
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={value.id ? 'Editar conta' : 'Nova conta'}
      footer={
        <div className="flex gap-2">
          {value.id && <button className="btn-danger" onClick={() => { if (confirmAction('Excluir conta e suas transações?')) { deleteAccount(value.id!); onClose() } }}>Excluir</button>}
          <button className="btn-primary flex-1" onClick={save}>Salvar</button>
        </div>
      }>
      <div className="space-y-4">
        <div><label className="label">Nome</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}>
            {Object.entries(ACCOUNT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label className="label">Saldo inicial (R$)</label><input className="input" inputMode="decimal" value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: e.target.value })} /></div>
        <div><span className="label">Cor</span><ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} colors={PALETTE} /></div>
      </div>
    </Sheet>
  )
}

function CardSheet({ value, onClose }: { value: Partial<CreditCard>; onClose: () => void }) {
  const { upsertCard, deleteCard } = useFinance()
  const [form, setForm] = useState({
    name: value.name ?? '', limit: String(value.limit ?? ''), closingDay: String(value.closingDay ?? 1),
    dueDay: String(value.dueDay ?? 10), color: value.color ?? PALETTE[1],
  })
  const day = (s: string) => Math.min(28, Math.max(1, Number(s) || 1))
  const save = () => {
    if (!form.name.trim()) return
    upsertCard({
      id: value.id, name: form.name.trim(), limit: Number(form.limit.replace(',', '.')) || 0,
      closingDay: day(form.closingDay), dueDay: day(form.dueDay), color: form.color,
    })
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={value.id ? 'Editar cartão' : 'Novo cartão'}
      footer={
        <div className="flex gap-2">
          {value.id && <button className="btn-danger" onClick={() => { if (confirmAction('Excluir cartão e suas transações?')) { deleteCard(value.id!); onClose() } }}>Excluir</button>}
          <button className="btn-primary flex-1" onClick={save}>Salvar</button>
        </div>
      }>
      <div className="space-y-4">
        <div className="flex h-24 items-end rounded-2xl p-4 text-white" style={{ background: form.color }}>
          <CardIcon className="mr-2" size={18} /> {form.name || 'Meu cartão'}
        </div>
        <div><label className="label">Nome</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="label">Limite (R$)</label><input className="input" inputMode="decimal" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Dia de fechamento</label><input className="input" type="number" min={1} max={28} value={form.closingDay} onChange={(e) => setForm({ ...form, closingDay: e.target.value })} /></div>
          <div><label className="label">Dia de vencimento</label><input className="input" type="number" min={1} max={28} value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} /></div>
        </div>
        <div><span className="label">Cor</span><ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} colors={[...PALETTE, '#1e293b']} /></div>
      </div>
    </Sheet>
  )
}
