import { NavLink } from 'react-router-dom'
import { Wallet, FileText, LayoutDashboard, KanbanSquare, Network, Settings } from 'lucide-react'
import { cn } from '../lib/utils'

export const NAV_ITEMS = [
  { to: '/finance', label: 'Finanças', icon: Wallet },
  { to: '/notes', label: 'Notas', icon: FileText },
  { to: '/boards', label: 'Quadros', icon: LayoutDashboard },
  { to: '/projects', label: 'Tarefas', icon: KanbanSquare },
  { to: '/graph', label: 'Grafo', icon: Network },
]

/** Barra inferior (mobile) */
export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/70 bg-white/90 backdrop-blur-xl md:hidden dark:border-white/5 dark:bg-ink-900/90"
    >
      <ul className="mx-auto flex max-w-lg">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition',
                  isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('flex h-8 w-14 items-center justify-center rounded-full transition', isActive && 'bg-brand-500/12 dark:bg-brand-400/15')}>
                    <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Barra lateral (tablet/desktop) — mesmo conjunto de destinos */
export function SideNav() {
  return (
    <nav aria-label="Navegação principal" className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col items-center gap-1 border-r border-slate-200/70 bg-white py-4 md:flex dark:border-white/5 dark:bg-ink-900">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">N</div>
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex w-16 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition',
              isActive ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5',
            )
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
      <div className="flex-1" />
      <NavLink
        to="/settings"
        className={({ isActive }) => cn('icon-btn', isActive && 'text-brand-600 dark:text-brand-400')}
        aria-label="Configurações"
      >
        <Settings size={20} />
      </NavLink>
    </nav>
  )
}
