import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn, money } from '../lib/utils'
import { useSettings } from '../store/settings'

/** Bottom sheet no mobile, modal centralizado no desktop */
export function Sheet({
  open, onClose, title, children, footer,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl dark:bg-ink-900">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-white/15" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="pb-safe border-t border-slate-100 px-5 py-3 dark:border-white/5">{footer}</div>}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, children }: {
  title: string; subtitle?: string; actions?: ReactNode; children?: ReactNode
}) {
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-slate-200/60 bg-slate-50/85 backdrop-blur-xl dark:border-white/5 dark:bg-ink-950/85">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </header>
  )
}

export function Money({ value, className, signed }: { value: number; className?: string; signed?: boolean }) {
  const hide = useSettings((s) => s.hideValues)
  const txt = hide ? 'R$ ••••' : (signed && value > 0 ? '+' : '') + money(value)
  return <span className={cn('tabular-nums', className)}>{txt}</span>
}

export function Fab({ onClick, label, icon }: { onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-500 active:scale-95 md:bottom-6"
    >
      {icon}
    </button>
  )
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">{icon}</div>
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string
}) {
  return (
    <div className={cn('flex rounded-xl bg-slate-100 p-1 dark:bg-white/5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition',
            value === o.value
              ? 'bg-white text-slate-900 shadow-sm dark:bg-ink-800 dark:text-white'
              : 'text-slate-500 dark:text-slate-400',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ColorPicker({ value, onChange, colors }: { value: string; onChange: (c: string) => void; colors: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Cor ${c}`}
          onClick={() => onChange(c)}
          className={cn('h-8 w-8 rounded-full border-2 transition', value === c ? 'scale-110 border-brand-500' : 'border-black/10 dark:border-white/10')}
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

export function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  const over = pct > 1
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${Math.min(100, pct * 100)}%`,
          background: over ? '#ef4444' : pct > 0.8 ? '#f59e0b' : (color ?? '#6366f1'),
        }}
      />
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{children}</h2>
      {action}
    </div>
  )
}

export function confirmAction(msg: string) {
  return window.confirm(msg)
}
