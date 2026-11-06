import { memo, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, FileText, Globe, ImageIcon, Plus, X } from 'lucide-react'
import MarkdownView from '../../components/MarkdownView'
import { useNotes } from '../../store/notes'
import { cn, uid } from '../../lib/utils'
import type { BoardItem } from '../../types'

export interface ItemHandlers {
  onPointerDown: (e: RPointerEvent, item: BoardItem, mode: 'move' | 'resize') => void
  onChange: (id: string, patch: Partial<BoardItem>) => void
  onStopEditing: () => void
  onSize: (id: string, w: number, h: number) => void
}

/** Texto escuro ou claro conforme a cor do cartão */
const isDarkColor = (hex: string) => {
  if (!hex.startsWith('#') || hex.length < 7) return false
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

function BoardItemViewInner({ item, x, y, selected, editing, connectSource, handlers }: {
  item: BoardItem
  x: number
  y: number
  selected: boolean
  editing: boolean
  connectSource: boolean
  handlers: ItemHandlers
}) {
  const ref = useRef<HTMLDivElement>(null)
  const note = useNotes((s) => (item.noteId ? s.notes.find((n) => n.id === item.noteId) : undefined))
  const updateNote = useNotes((s) => s.updateNote)

  // informa o tamanho real (para desenhar conexões)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => handlers.onSize(item.id, el.offsetWidth, el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [item.id, handlers])

  const transparent = item.color === 'transparent'
  const darkCard = isDarkColor(item.color)

  return (
    <div
      ref={ref}
      data-item={item.id}
      onPointerDown={(e) => handlers.onPointerDown(e, item, 'move')}
      className={cn(
        'absolute select-none rounded-xl transition-shadow',
        !transparent && 'shadow-sm',
        darkCard ? 'text-slate-100' : transparent ? 'text-slate-900 dark:text-slate-100' : 'text-slate-800',
        item.type === 'column' && 'rounded-2xl',
        selected ? 'ring-2 ring-brand-500 shadow-lg' : !transparent && 'ring-1 ring-black/5',
        connectSource && 'ring-4 ring-amber-400',
        editing ? 'cursor-text' : 'cursor-grab',
      )}
      style={{
        transform: `translate(${x}px, ${y}px)`,
        width: item.w,
        height: item.type === 'column' || item.type === 'image' ? item.h : undefined,
        background: transparent ? 'transparent' : item.color,
        touchAction: 'none',
      }}
    >
      <Content item={item} editing={editing} handlers={handlers} note={note} updateNote={updateNote} />

      {selected && !editing && (
        <div
          onPointerDown={(e) => handlers.onPointerDown(e, item, 'resize')}
          className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-brand-500 shadow"
          aria-label="Redimensionar"
        />
      )}
    </div>
  )
}

function Content({ item, editing, handlers, note, updateNote }: {
  item: BoardItem
  editing: boolean
  handlers: ItemHandlers
  note: ReturnType<typeof useNotes.getState>['notes'][number] | undefined
  updateNote: ReturnType<typeof useNotes.getState>['updateNote']
}) {
  const set = (patch: Partial<BoardItem>) => handlers.onChange(item.id, patch)

  switch (item.type) {
    case 'text':
      return editing ? (
        <AutoTextarea value={item.text} onChange={(text) => set({ text })} onDone={handlers.onStopEditing} placeholder="Escreva algo… (Markdown)" />
      ) : (
        <div className="p-3 text-sm">
          {item.text.trim() ? <MarkdownView content={item.text} className="!text-sm [&_h1]:!text-xl" /> : <span className="opacity-40">Toque duas vezes para escrever</span>}
        </div>
      )

    case 'note':
      if (!note) return <div className="p-3 text-sm opacity-60">Nota removida</div>
      return (
        <div className="p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-60">
            <FileText size={12} /> Nota
          </div>
          <Link
            to={`/notes/${note.id}`}
            data-nodrag
            onPointerDown={(e) => e.stopPropagation()}
            className="mb-1 block font-semibold text-brand-700 hover:underline"
          >
            {note.title}
          </Link>
          <div className="max-h-48 overflow-hidden text-sm [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
            <MarkdownView
              content={note.content.replace(/^#\s.*\n?/, '')}
              onChange={(content) => updateNote(note.id, { content })}
              className="!text-[13px] [&_h2]:!text-base"
            />
          </div>
        </div>
      )

    case 'todo': {
      const todos = item.todos ?? []
      const doneCount = todos.filter((t) => t.done).length
      return (
        <div className="p-3">
          {editing ? (
            <input
              data-nodrag
              autoFocus
              className="mb-2 w-full rounded bg-black/5 px-1 font-semibold outline-none"
              value={item.text}
              onChange={(e) => set({ text: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handlers.onStopEditing()}
            />
          ) : (
            <p className="mb-1 font-semibold">{item.text || 'Checklist'}</p>
          )}
          {todos.length > 0 && (
            <div className="mb-2 h-1 overflow-hidden rounded-full bg-black/10">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / todos.length) * 100}%` }} />
            </div>
          )}
          <ul className="space-y-1 text-sm">
            {todos.map((t) => (
              <li key={t.id} className="group flex items-start gap-2" data-nodrag onPointerDown={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-emerald-600"
                  checked={t.done}
                  onChange={() => set({ todos: todos.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) })}
                />
                {editing ? (
                  <input
                    className="flex-1 bg-transparent outline-none"
                    value={t.text}
                    onChange={(e) => set({ todos: todos.map((x) => (x.id === t.id ? { ...x, text: e.target.value } : x)) })}
                  />
                ) : (
                  <span className={cn('flex-1', t.done && 'line-through opacity-50')}>{t.text}</span>
                )}
                {editing && (
                  <button onClick={() => set({ todos: todos.filter((x) => x.id !== t.id) })} aria-label="Remover item"><X size={14} /></button>
                )}
              </li>
            ))}
          </ul>
          <AddTodo onAdd={(text) => set({ todos: [...todos, { id: uid(), text, done: false }] })} />
        </div>
      )
    }

    case 'link': {
      let host = item.text
      try { host = new URL(item.text).hostname.replace(/^www\./, '') } catch { /* url inválida */ }
      return editing ? (
        <div className="p-3">
          <input data-nodrag autoFocus className="w-full rounded bg-black/5 px-2 py-1 text-sm outline-none" value={item.text} placeholder="https://…"
            onChange={(e) => set({ text: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handlers.onStopEditing()} />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/5"><Globe size={18} /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{host || 'Link'}</p>
            <p className="truncate text-[11px] opacity-60">{item.text}</p>
          </div>
          {item.text && (
            <a href={item.text} target="_blank" rel="noopener noreferrer" data-nodrag onPointerDown={(e) => e.stopPropagation()} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Abrir link">
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      )
    }

    case 'image':
      return editing || !item.text ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
          <ImageIcon size={24} className="opacity-40" />
          <input data-nodrag autoFocus={editing} className="w-full rounded bg-black/5 px-2 py-1 text-xs outline-none" value={item.text} placeholder="URL da imagem"
            onChange={(e) => set({ text: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handlers.onStopEditing()} />
        </div>
      ) : (
        <img src={item.text} alt="" draggable={false} className="pointer-events-none h-full w-full rounded-xl object-cover" />
      )

    case 'column':
      return (
        <div className="p-3">
          {editing ? (
            <input data-nodrag autoFocus className="w-full rounded bg-black/5 px-1 text-sm font-bold uppercase tracking-wide outline-none" value={item.text}
              onChange={(e) => set({ text: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handlers.onStopEditing()} />
          ) : (
            <p className="text-sm font-bold uppercase tracking-wide opacity-70">{item.text || 'Coluna'}</p>
          )}
        </div>
      )
  }
}

function AutoTextarea({ value, onChange, onDone, placeholder }: { value: string; onChange: (v: string) => void; onDone: () => void; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])
  return (
    <textarea
      ref={ref}
      data-nodrag
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Escape' && onDone()}
      className="block w-full resize-none bg-transparent p-3 font-mono text-[13px] leading-relaxed outline-none"
      rows={3}
    />
  )
}

function AddTodo({ onAdd }: { onAdd: (t: string) => void }) {
  const [v, setV] = useState('')
  return (
    <form
      data-nodrag
      onPointerDown={(e) => e.stopPropagation()}
      onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV('') } }}
      className="mt-1 flex items-center gap-2 text-sm opacity-60 focus-within:opacity-100"
    >
      <Plus size={14} />
      <input className="flex-1 bg-transparent outline-none" placeholder="Adicionar item" value={v} onChange={(e) => setV(e.target.value)} />
    </form>
  )
}

export default memo(BoardItemViewInner)
