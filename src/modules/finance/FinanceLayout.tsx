import { useState } from 'react'
import { NavLink, Outlet, useOutletContext, Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Eye, EyeOff, Plus, Settings } from 'lucide-react'
import { Fab, PageHeader } from '../../components/ui'
import { addMonths, cn, monthKey, monthLabel } from '../../lib/utils'
import { useSettings } from '../../store/settings'
import QuickAddSheet from './QuickAddSheet'
import type { Transaction } from '../../types'

const TABS = [
  { to: '/finance', label: 'Resumo', end: true },
  { to: '/finance/transactions', label: 'Transações' },
  { to: '/finance/accounts', label: 'Contas e cartões' },
  { to: '/finance/budgets', label: 'Orçamentos' },
  { to: '/finance/reports', label: 'Gráficos' },
]

export interface FinanceCtx {
  month: string
  setMonth: (m: string) => void
  openQuickAdd: (edit?: Transaction, preset?: Partial<Transaction>) => void
}

export const useFinanceCtx = () => useOutletContext<FinanceCtx>()

export default function FinanceLayout() {
  const [month, setMonth] = useState(monthKey(new Date()))
  const [sheet, setSheet] = useState<{ open: boolean; edit?: Transaction; preset?: Partial<Transaction> }>({ open: false })
  const { hideValues, toggleHideValues } = useSettings()
  const isCurrent = month === monthKey(new Date())

  return (
    <>
      <PageHeader
        title="Finanças"
        actions={
          <>
            <button className="icon-btn" onClick={toggleHideValues} aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'}>
              {hideValues ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <Link to="/settings" className="icon-btn md:hidden" aria-label="Configurações"><Settings size={18} /></Link>
          </>
        }
      >
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 pb-2">
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
          <button
            className="flex-1 text-center text-sm font-semibold"
            onClick={() => setMonth(monthKey(new Date()))}
            title="Voltar ao mês atual"
          >
            {monthLabel(month)}
            {!isCurrent && <span className="ml-2 text-xs font-normal text-brand-500">hoje ↺</span>}
          </button>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês"><ChevronRight size={18} /></button>
        </div>
        <div className="no-scrollbar mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cn('chip', isActive && 'chip-active')}>
              {t.label}
            </NavLink>
          ))}
        </div>
      </PageHeader>

      <div className="mx-auto max-w-5xl px-4 py-4">
        <Outlet
          context={{
            month,
            setMonth,
            openQuickAdd: (edit, preset) => setSheet({ open: true, edit, preset }),
          } satisfies FinanceCtx}
        />
      </div>

      <Fab label="Nova transação" icon={<Plus size={26} />} onClick={() => setSheet({ open: true })} />
      <QuickAddSheet
        key={sheet.edit?.id ?? (sheet.open ? 'new' : 'closed')}
        open={sheet.open}
        edit={sheet.edit}
        preset={sheet.preset}
        onClose={() => setSheet({ open: false })}
      />
    </>
  )
}
