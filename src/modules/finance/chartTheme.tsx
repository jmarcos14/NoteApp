import { money } from '../../lib/utils'
import { useSettings } from '../../store/settings'

export function useChartTheme() {
  // re-renderiza quando o tema muda
  useSettings((s) => s.theme)
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  return {
    dark,
    muted: dark ? '#64748b' : '#94a3b8',
    grid: dark ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.06)',
    cursor: dark ? 'rgba(255,255,255,.04)' : 'rgba(15,23,42,.04)',
  }
}

interface TooltipPayload {
  name?: string
  value?: number
  color?: string
  payload?: { label?: string; fill?: string; color?: string }
}

/** Tooltip estilizado compatível com claro/escuro */
export function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  const hide = useSettings((s) => s.hideValues)
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-ink-850">
      {(label ?? payload[0].payload?.label) && <p className="mb-1 font-semibold">{label ?? payload[0].payload?.label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.payload?.color ?? p.payload?.fill }} />
          <span className="text-slate-500 dark:text-slate-400">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums">{hide ? '••••' : money(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </div>
  )
}
