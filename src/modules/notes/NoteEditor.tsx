import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Bold, CheckSquare, Eye, FolderKanban, Heading2, Italic, Link2, List, Network, Pencil, Pin, PinOff, Trash2,
} from 'lucide-react'
import MarkdownView, { useOpenWikilink, useTitleIndex } from '../../components/MarkdownView'
import { EmptyState, confirmAction } from '../../components/ui'
import { useNotes } from '../../store/notes'
import { useProjects } from '../../store/projects'
import { backlinksFor, extractLinks, normalizeTitle, unlinkedMentions } from '../../lib/wikilinks'
import { cn, relativeTime } from '../../lib/utils'

type Mode = 'edit' | 'preview'

export default function NoteEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { notes, updateNote, renameNote, deleteNote } = useNotes()
  const { projects, tasks } = useProjects()
  const note = notes.find((n) => n.id === id)
  const [mode, setMode] = useState<Mode>(params.get('edit') ? 'edit' : 'preview')
  const [title, setTitle] = useState(note?.title ?? '')
  const [titleError, setTitleError] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const index = useTitleIndex()
  const openLink = useOpenWikilink()

  // autocomplete de [[links]]
  const [suggest, setSuggest] = useState<{ query: string; start: number } | null>(null)
  const [sel, setSel] = useState(0)

  useEffect(() => {
    setTitle(note?.title ?? '')
    setTitleError('')
  }, [note?.id, note?.title])

  const related = useMemo(() => {
    if (!note) return null
    const outgoing = extractLinks(note.content).map((k) => ({ key: k, hit: index.get(k) }))
    return {
      backlinks: backlinksFor(note.title, notes, note.id),
      mentions: unlinkedMentions(note.title, notes, note.id),
      outgoing,
      tasks: tasks.filter((t) => t.noteId === note.id),
    }
  }, [note, notes, index, tasks])

  const suggestions = useMemo(() => {
    if (!suggest) return []
    const q = suggest.query.toLowerCase()
    const items = [
      ...notes.filter((n) => n.id !== note?.id).map((n) => ({ title: n.title, kind: 'note' as const })),
      ...projects.map((p) => ({ title: p.name, kind: 'project' as const })),
    ]
    const res = items.filter((i) => i.title.toLowerCase().includes(q)).slice(0, 6)
    if (q && !items.some((i) => normalizeTitle(i.title) === normalizeTitle(q))) res.push({ title: suggest.query, kind: 'new' as never })
    return res as { title: string; kind: 'note' | 'project' | 'new' }[]
  }, [suggest, notes, projects, note?.id])

  if (!note || !related) {
    return (
      <EmptyState
        icon={<Pencil />}
        title="Nota não encontrada"
        action={<Link className="btn-primary" to="/notes">Voltar às notas</Link>}
      />
    )
  }

  const setContent = (content: string) => updateNote(note.id, { content })

  const commitTitle = () => {
    const t = title.trim()
    if (!t) return setTitle(note.title)
    const clash = notes.find((n) => n.id !== note.id && normalizeTitle(n.title) === normalizeTitle(t))
    if (clash) {
      setTitleError('Já existe uma nota com este título')
      return
    }
    setTitleError('')
    renameNote(note.id, t)
  }

  const detectSuggest = (value: string, caret: number) => {
    const before = value.slice(0, caret)
    const m = /\[\[([^\]\n|]*)$/.exec(before)
    if (m) {
      setSuggest({ query: m[1], start: caret - m[1].length })
      setSel(0)
    } else setSuggest(null)
  }

  const applySuggestion = (t: string) => {
    const ta = taRef.current
    if (!ta || !suggest) return
    const v = note.content
    const caret = ta.selectionStart
    const after = v.slice(caret)
    const closing = after.startsWith(']]') ? '' : ']]'
    const next = v.slice(0, suggest.start) + t + closing + after
    setContent(next)
    setSuggest(null)
    const pos = suggest.start + t.length + 2
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
  }

  /** Envolve a seleção (ou insere prefixo de linha) */
  const format = (kind: 'bold' | 'italic' | 'h2' | 'list' | 'todo' | 'link') => {
    const ta = taRef.current
    if (!ta) return
    const v = note.content
    const s = ta.selectionStart
    const e = ta.selectionEnd
    const selected = v.slice(s, e)
    let next = v
    let cursor = e
    const wrap = (l: string, r = l) => {
      next = v.slice(0, s) + l + selected + r + v.slice(e)
      cursor = selected ? e + l.length + r.length : s + l.length
    }
    const linePrefix = (p: string) => {
      const ls = v.lastIndexOf('\n', s - 1) + 1
      next = v.slice(0, ls) + p + v.slice(ls)
      cursor = e + p.length
    }
    if (kind === 'bold') wrap('**')
    if (kind === 'italic') wrap('_')
    if (kind === 'link') wrap('[[', ']]')
    if (kind === 'h2') linePrefix('## ')
    if (kind === 'list') linePrefix('- ')
    if (kind === 'todo') linePrefix('- [ ] ')
    setContent(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(cursor, cursor)
      if (kind === 'link' && !selected) detectSuggest(next, cursor)
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggest && suggestions.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((sel + 1) % suggestions.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel((sel - 1 + suggestions.length) % suggestions.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applySuggestion(suggestions[sel].title); return }
      if (e.key === 'Escape') { setSuggest(null); return }
    }
    // continua listas ao pressionar Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      const ta = e.currentTarget
      const v = note.content
      const s = ta.selectionStart
      const ls = v.lastIndexOf('\n', s - 1) + 1
      const line = v.slice(ls, s)
      const m = /^(\s*)([-*+]|\d+\.)\s(\[[ x]\]\s)?/.exec(line)
      if (m) {
        e.preventDefault()
        if (line.trim() === m[0].trim()) {
          // item vazio: encerra a lista
          const next = v.slice(0, ls) + v.slice(s)
          setContent(next)
          requestAnimationFrame(() => ta.setSelectionRange(ls, ls))
          return
        }
        const bullet = /\d+\./.test(m[2]) ? `${parseInt(m[2]) + 1}.` : m[2]
        const ins = `\n${m[1]}${bullet} ${m[3] ? '[ ] ' : ''}`
        const next = v.slice(0, s) + ins + v.slice(ta.selectionEnd)
        setContent(next)
        requestAnimationFrame(() => ta.setSelectionRange(s + ins.length, s + ins.length))
      }
    }
  }

  const remove = () => {
    if (!confirmAction(`Excluir "${note.title}"? Links para ela ficarão pendentes.`)) return
    deleteNote(note.id)
    navigate('/notes')
  }

  const ModeToggle = (
    <div className="flex rounded-xl bg-slate-100 p-0.5 dark:bg-white/5">
      {(['edit', 'preview'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          aria-label={m === 'edit' ? 'Editar' : 'Visualizar'}
          className={cn('rounded-lg p-1.5 transition', mode === m ? 'bg-white text-brand-600 shadow-sm dark:bg-ink-800 dark:text-brand-400' : 'text-slate-500')}
        >
          {m === 'edit' ? <Pencil size={16} /> : <Eye size={16} />}
        </button>
      ))}
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl">
      <header className="pt-safe sticky top-0 z-30 border-b border-slate-200/60 bg-slate-50/85 backdrop-blur-xl dark:border-white/5 dark:bg-ink-950/85">
        <div className="flex items-center gap-1 px-2 py-2">
          <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Voltar"><ArrowLeft size={18} /></button>
          <div className="flex-1" />
          {ModeToggle}
          <button className="icon-btn" onClick={() => updateNote(note.id, { pinned: !note.pinned })} aria-label={note.pinned ? 'Desafixar' : 'Fixar'}>
            {note.pinned ? <PinOff size={18} /> : <Pin size={18} />}
          </button>
          <Link className="icon-btn" to={`/graph?focus=note:${note.id}`} aria-label="Ver no grafo"><Network size={18} /></Link>
          <button className="icon-btn hover:!text-red-500" onClick={remove} aria-label="Excluir nota"><Trash2 size={18} /></button>
        </div>
      </header>

      <div className="px-4 pb-6 pt-4">
        <input
          className="w-full bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-slate-300"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), taRef.current?.focus())}
          placeholder="Título"
          aria-label="Título da nota"
        />
        {titleError && <p className="text-xs text-red-500">{titleError}</p>}
        <p className="mb-4 mt-1 text-xs text-slate-400">
          Editada {relativeTime(note.updatedAt)} · {note.content.split(/\s+/).filter(Boolean).length} palavras
        </p>

        {mode === 'edit' ? (
          <div className="relative">
            <div className="no-scrollbar sticky top-[calc(52px+env(safe-area-inset-top))] z-20 -mx-1 mb-2 flex gap-1 overflow-x-auto rounded-xl bg-slate-50/90 p-1 backdrop-blur dark:bg-ink-950/90">
              {[
                { k: 'bold', icon: Bold, label: 'Negrito' },
                { k: 'italic', icon: Italic, label: 'Itálico' },
                { k: 'h2', icon: Heading2, label: 'Título' },
                { k: 'list', icon: List, label: 'Lista' },
                { k: 'todo', icon: CheckSquare, label: 'Checklist' },
                { k: 'link', icon: Link2, label: 'Link [[ ]]' },
              ].map(({ k, icon: Icon, label }) => (
                <button
                  key={k}
                  className="icon-btn shrink-0"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => format(k as Parameters<typeof format>[0])}
                  aria-label={label}
                  title={label}
                >
                  <Icon size={17} />
                </button>
              ))}
            </div>
            <textarea
              ref={taRef}
              autoFocus={!!params.get('edit')}
              value={note.content}
              onChange={(e) => {
                setContent(e.target.value)
                detectSuggest(e.target.value, e.target.selectionStart)
              }}
              onKeyDown={onKeyDown}
              onClick={(e) => detectSuggest(note.content, e.currentTarget.selectionStart)}
              onBlur={() => setTimeout(() => setSuggest(null), 150)}
              placeholder="Escreva em Markdown… use [[ para linkar notas"
              className="min-h-[55dvh] w-full resize-none bg-transparent font-mono text-[15px] leading-relaxed outline-none"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            {suggest && suggestions.length > 0 && (
              <div className="card fixed inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md overflow-hidden p-1 shadow-xl md:bottom-6">
                <p className="px-3 py-1 text-[11px] font-semibold uppercase text-slate-400">Linkar para…</p>
                {suggestions.map((s, i) => (
                  <button
                    key={s.kind + s.title}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applySuggestion(s.title)}
                    className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm', i === sel && 'bg-brand-500/10')}
                  >
                    {s.kind === 'project' ? <FolderKanban size={14} className="text-orange-500" /> : <Link2 size={14} className="text-brand-500" />}
                    <span className="flex-1 truncate">{s.kind === 'new' ? `Criar "${s.title}"` : s.title}</span>
                    {s.kind === 'project' && <span className="text-[10px] text-slate-400">projeto</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div onDoubleClick={() => setMode('edit')}>
            {note.content.trim() ? (
              <MarkdownView content={note.content} onChange={setContent} />
            ) : (
              <button className="text-slate-400" onClick={() => setMode('edit')}>Nota vazia — toque para editar</button>
            )}
          </div>
        )}

        {/* Painel de conexões */}
        <section className="mt-10 space-y-5 border-t border-slate-200 pt-5 dark:border-white/5">
          <LinkGroup title={`Backlinks (${related.backlinks.length})`} empty="Nenhuma nota aponta para esta ainda.">
            {related.backlinks.map((b) => (
              <Link key={b.id} to={`/notes/${b.id}`} className="card block p-3 hover:border-brand-500/40">
                <p className="text-sm font-medium">{b.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{contextSnippet(b.content, note.title)}</p>
              </Link>
            ))}
          </LinkGroup>

          {related.outgoing.length > 0 && (
            <LinkGroup title={`Links de saída (${related.outgoing.length})`}>
              <div className="flex flex-wrap gap-2">
                {related.outgoing.map(({ key, hit }) => (
                  <button
                    key={key}
                    onClick={() => openLink(hit?.title ?? key)}
                    className={cn('chip', !hit && 'border-dashed opacity-70', hit?.kind === 'project' && 'border-orange-500/40 text-orange-600 dark:text-orange-400')}
                  >
                    {hit?.kind === 'project' ? <FolderKanban size={12} /> : <Link2 size={12} />} {hit?.title ?? key}
                  </button>
                ))}
              </div>
            </LinkGroup>
          )}

          {related.mentions.length > 0 && (
            <LinkGroup title={`Menções sem link (${related.mentions.length})`}>
              {related.mentions.map((m) => (
                <div key={m.id} className="card flex items-center gap-2 p-3">
                  <Link to={`/notes/${m.id}`} className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{m.title}</p>
                    <p className="line-clamp-1 text-xs text-slate-500">{contextSnippet(m.content, note.title)}</p>
                  </Link>
                  <button
                    className="btn-ghost !px-2 !py-1 text-xs"
                    onClick={() => {
                      const re = new RegExp(`(?<!\\[\\[)\\b(${note.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b(?!\\]\\])`, 'i')
                      updateNote(m.id, { content: m.content.replace(re, '[[$1]]') })
                    }}
                  >
                    Linkar
                  </button>
                </div>
              ))}
            </LinkGroup>
          )}

          {related.tasks.length > 0 && (
            <LinkGroup title="Tarefas vinculadas">
              {related.tasks.map((t) => (
                <Link key={t.id} to={t.projectId ? `/projects/${t.projectId}` : '/projects'} className="card flex items-center gap-2 p-3 text-sm">
                  <span className={cn('h-2 w-2 rounded-full', t.status === 'done' ? 'bg-emerald-500' : t.status === 'doing' ? 'bg-amber-500' : 'bg-slate-400')} />
                  <span className={cn(t.status === 'done' && 'line-through opacity-60')}>{t.title}</span>
                </Link>
              ))}
            </LinkGroup>
          )}
        </section>
      </div>
    </div>
  )
}

function LinkGroup({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {has ? <div className="space-y-2">{children}</div> : empty && <p className="text-sm text-slate-400">{empty}</p>}
    </div>
  )
}

function contextSnippet(content: string, title: string) {
  const i = content.toLowerCase().indexOf(title.toLowerCase())
  if (i === -1) return content.slice(0, 100)
  const s = Math.max(0, i - 50)
  return (s > 0 ? '…' : '') + content.slice(s, i + title.length + 60).replace(/\n/g, ' ') + '…'
}
