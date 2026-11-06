import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, Link2, Pin, Plus, Search, Settings } from 'lucide-react'
import { EmptyState, Fab, PageHeader } from '../../components/ui'
import { useNotes } from '../../store/notes'
import { backlinksFor, extractLinks } from '../../lib/wikilinks'
import { cn, relativeTime } from '../../lib/utils'

const excerpt = (md: string) =>
  md
    .replace(/^#+\s.*$/m, '')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a)
    .replace(/[#*_>`~-]|\[[ x]\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140)

export default function NotesList() {
  const notes = useNotes((s) => s.notes)
  const createNote = useNotes((s) => s.createNote)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [sort, setSort] = useState<'updated' | 'title' | 'links'>('updated')

  const tags = useMemo(() => {
    const m = new Map<string, number>()
    notes.forEach((n) => n.tags.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [notes])

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    const withMeta = notes
      .filter((n) => !tag || n.tags.includes(tag))
      .filter((n) => !term || n.title.toLowerCase().includes(term) || n.content.toLowerCase().includes(term))
      .map((n) => ({ n, backlinks: backlinksFor(n.title, notes, n.id).length, out: extractLinks(n.content).length }))
    withMeta.sort((a, b) => {
      if (!!b.n.pinned !== !!a.n.pinned) return b.n.pinned ? 1 : -1
      if (sort === 'title') return a.n.title.localeCompare(b.n.title)
      if (sort === 'links') return b.backlinks + b.out - (a.backlinks + a.out)
      return b.n.updatedAt - a.n.updatedAt
    })
    return withMeta
  }, [notes, q, tag, sort])

  const newNote = () => {
    const n = createNote('Nova nota', '# Nova nota\n\n')
    navigate(`/notes/${n.id}?edit=1`)
  }

  return (
    <>
      <PageHeader
        title="Notas"
        subtitle={`${notes.length} notas · links bidirecionais com [[ ]]`}
        actions={<Link to="/settings" className="icon-btn md:hidden" aria-label="Configurações"><Settings size={18} /></Link>}
      >
        <div className="mx-auto max-w-5xl space-y-2 px-4 pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar em títulos e conteúdo…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            <select className="chip bg-transparent" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Ordenar">
              <option value="updated">Recentes</option>
              <option value="title">A–Z</option>
              <option value="links">Mais conectadas</option>
            </select>
            <button className={cn('chip', !tag && 'chip-active')} onClick={() => setTag(null)}>Todas</button>
            {tags.map(([t, c]) => (
              <button key={t} className={cn('chip', tag === t && 'chip-active')} onClick={() => setTag(tag === t ? null : t)}>
                #{t} <span className="opacity-60">{c}</span>
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-5xl px-4 py-4">
        {list.length === 0 ? (
          <EmptyState icon={<FileText />} title="Nenhuma nota encontrada" text="Crie uma nota e conecte ideias com [[links]]." action={<button className="btn-primary" onClick={newNote}><Plus size={16} /> Nova nota</button>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map(({ n, backlinks, out }) => (
              <Link key={n.id} to={`/notes/${n.id}`} className="card group flex flex-col p-4 transition hover:border-brand-500/40 active:scale-[.99]">
                <div className="flex items-start gap-2">
                  <h3 className="flex-1 font-semibold leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400">{n.title}</h3>
                  {n.pinned && <Pin size={14} className="mt-1 shrink-0 text-brand-500" />}
                </div>
                <p className="mt-1 line-clamp-3 flex-1 text-sm text-slate-500 dark:text-slate-400">{excerpt(n.content) || 'Nota vazia'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <span>{relativeTime(n.updatedAt)}</span>
                  {(backlinks > 0 || out > 0) && (
                    <span className="flex items-center gap-1"><Link2 size={12} /> {out} → · ← {backlinks}</span>
                  )}
                  {n.tags.slice(0, 3).map((t) => <span key={t} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">#{t}</span>)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Fab label="Nova nota" icon={<Plus size={26} />} onClick={newNote} />
    </>
  )
}
