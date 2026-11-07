import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Segmented, Sheet } from '../../components/ui'
import { useFinance } from '../../store/finance'
import { cn, isoDate } from '../../lib/utils'
import type { Transaction, TransactionType } from '../../types'

/** Converte "1.234,56" / "1234.56" / "12,5" em número */
function parseAmount(s: string) {
  const clean = s.replace(/[^\d,.-]/g, '')
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  return Number(normalized)
}

const QUICK_AMOUNTS = [10, 25, 50, 100]

export default function QuickAddSheet({ open, onClose, edit, preset }: {
  open: boolean; onClose: () => void; edit?: Transaction; preset?: Partial<Transaction>
}) {
  const { accounts, cards, categories, addTransaction, updateTransaction, deleteTransaction } = useFinance()
  const init = edit ?? preset
  const [type, setType] = useState<TransactionType>(init?.type ?? 'expense')
  const [amount, setAmount] = useState(edit ? String(edit.amount).replace('.', ',') : '')
  const [description, setDescription] = useState(init?.description ?? '')
  const [date, setDate] = useState(init?.date ?? isoDate())
  const [categoryId, setCategoryId] = useState<string | undefined>(init?.categoryId)
  // origem codificada como "acc:<id>" ou "card:<id>"
  const [source, setSource] = useState<string>(
    init?.cardId ? `card:${init.cardId}` : `acc:${init?.accountId ?? accounts[0]?.id ?? ''}`,
  )
  const [dest, setDest] = useState<string>(
    init?.toCardId ? `card:${init.toCardId}` : init?.toAccountId ? `acc:${init.toAccountId}` : '',
  )

  const cats = useMemo(() => categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense')), [categories, type])
  const value = parseAmount(amount)
  const valid =
    value > 0 && (type !== 'transfer' || (dest && dest !== source)) && (type === 'transfer' || source.split(':')[1])

  const submit = () => {
    if (!valid) return
    const [srcKind, srcId] = source.split(':')
    const [dstKind, dstId] = dest.split(':')
    const t: Omit<Transaction, 'id' | 'createdAt'> = {
      type,
      amount: Math.round(value * 100) / 100,
      date,
      description:
        description.trim() ||
        (type === 'transfer' ? 'Transferência' : cats.find((c) => c.id === categoryId)?.name ?? (type === 'income' ? 'Receita' : 'Despesa')),
      categoryId: type === 'transfer' ? undefined : categoryId,
      accountId: srcKind === 'acc' ? srcId : undefined,
      cardId: type === 'expense' && srcKind === 'card' ? srcId : undefined,
      toAccountId: type === 'transfer' && dstKind === 'acc' ? dstId : undefined,
      toCardId: type === 'transfer' && dstKind === 'card' ? dstId : undefined,
    }
    if (edit) updateTransaction(edit.id, t)
    else addTransaction(t)
    onClose()
  }

  const sourceOptions = (
    <>
      <optgroup label="Contas">
        {accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}
      </optgroup>
      {type === 'expense' && cards.length > 0 && (
        <optgroup label="Cartões de crédito">
          {cards.filter((c) => !c.archived).map((c) => <option key={c.id} value={`card:${c.id}`}>💳 {c.name}</option>)}
        </optgroup>
      )}
    </>
  )

  const accent = type === 'income' ? 'text-emerald-500' : type === 'expense' ? 'text-red-500' : 'text-brand-500'

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={edit ? 'Editar transação' : 'Lançamento rápido'}
      footer={
        <div className="flex gap-2">
          {edit && (
            <button className="btn-danger" onClick={() => { deleteTransaction(edit.id); onClose() }} aria-label="Excluir">
              <Trash2 size={16} />
            </button>
          )}
          <button className="btn-primary flex-1" disabled={!valid} onClick={submit}>
            {edit ? 'Salvar alterações' : 'Adicionar'}
          </button>
        </div>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-4">
        <Segmented
          value={type}
          onChange={(t) => {
            setType(t)
            setCategoryId(undefined)
            if (t !== 'expense' && source.startsWith('card:')) setSource(`acc:${accounts[0]?.id ?? ''}`)
          }}
          options={[
            { value: 'expense', label: 'Despesa' },
            { value: 'income', label: 'Receita' },
            { value: 'transfer', label: 'Transferência' },
          ]}
        />

        <div className="text-center">
          <div className={cn('flex items-baseline justify-center gap-1 text-4xl font-bold', accent)}>
            <span className="text-xl">R$</span>
            <input
              autoFocus
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-48 bg-transparent text-center !text-4xl outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
              aria-label="Valor"
            />
          </div>
          <div className="mt-2 flex justify-center gap-2">
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q}
                type="button"
                className="chip"
                onClick={() => setAmount(String((Number.isFinite(value) ? value : 0) + q).replace('.', ','))}
              >
                +{q}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="qa-desc">Descrição</label>
          <input id="qa-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Mercado, Uber, Salário…" />
        </div>

        {type !== 'transfer' && (
          <div>
            <span className="label">Categoria</span>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(categoryId === c.id ? undefined : c.id)}
                  className={cn('chip', categoryId === c.id && 'chip-active')}
                >
                  <span>{c.emoji}</span> {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className={type === 'transfer' ? '' : 'col-span-1'}>
            <label className="label" htmlFor="qa-src">{type === 'transfer' ? 'De' : type === 'income' ? 'Conta' : 'Pagar com'}</label>
            <select id="qa-src" className="input" value={source} onChange={(e) => setSource(e.target.value)}>
              {sourceOptions}
            </select>
          </div>
          {type === 'transfer' ? (
            <div>
              <label className="label" htmlFor="qa-dst">Para</label>
              <select id="qa-dst" className="input" value={dest} onChange={(e) => setDest(e.target.value)}>
                <option value="">Selecione…</option>
                <optgroup label="Contas">
                  {accounts.map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}
                </optgroup>
                <optgroup label="Pagar fatura">
                  {cards.map((c) => <option key={c.id} value={`card:${c.id}`}>💳 {c.name}</option>)}
                </optgroup>
              </select>
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="qa-date">Data</label>
              <input id="qa-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
        </div>
        {type === 'transfer' && (
          <div>
            <label className="label" htmlFor="qa-date2">Data</label>
            <input id="qa-date2" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
