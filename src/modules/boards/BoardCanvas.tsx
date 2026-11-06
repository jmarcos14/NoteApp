import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, CheckSquare, Columns3, Copy, FileText, ImageIcon, Link2, Maximize, Pencil, Search, Spline, StickyNote,
  Trash2, Type, ZoomIn, ZoomOut,
} from 'lucide-react'
import BoardItemView, { type ItemHandlers } from './BoardItemView'
import { EmptyState, Sheet } from '../../components/ui'
import { useBoards } from '../../store/boards'
import { useNotes } from '../../store/notes'
import { CARD_COLORS, clamp, cn } from '../../lib/utils'
import type { BoardItem, BoardItemType } from '../../types'

const MIN_SCALE = 0.2
const MAX_SCALE = 3
type Vec = { x: number; y: number }
type Viewport = { x: number; y: number; scale: number }

interface DragState {
  mode: 'move' | 'resize'
  pointerId: number
  start: Vec
  origin: Record<string, Vec> // posições iniciais dos itens movidos
  size?: { w: number; h: number }
  itemId: string
  moved: boolean
}

export default function BoardCanvas() {
  const { id } = useParams()
  const navigate = useNavigate()
  const board = useBoards((s) => s.boards.find((b) => b.id === id))
  const { updateBoard, addItem, updateItem, deleteItem, bringToFront, toggleConnection } = useBoards()
  const createNote = useNotes((s) => s.createNote)

  const containerRef = useRef<HTMLDivElement>(null)
  const [vp, setVp] = useState<Viewport>(board?.viewport ?? { x: 0, y: 0, scale: 1 })
  const vpRef = useRef(vp)
  vpRef.current = vp

  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [override, setOverride] = useState<Record<string, Partial<BoardItem>>>({})
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({})
  const [notePicker, setNotePicker] = useState(false)

  const pointers = useRef(new Map<number, Vec>())
  const pan = useRef<{ start: Vec; vp: Viewport } | null>(null)
  const pinch = useRef<{ d0: number; mid0: Vec; vp: Viewport } | null>(null)
  const drag = useRef<DragState | null>(null)
  const lastTap = useRef<{ id: string; t: number } | null>(null)

  // persiste o viewport com debounce
  useEffect(() => {
    if (!board) return
    const t = setTimeout(() => updateBoard(board.id, { viewport: vp }), 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp])

  const toLocal = (e: { clientX: number; clientY: number }): Vec => {
    const r = containerRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const zoomAt = useCallback((p: Vec, factor: number) => {
    setVp((v) => {
      const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
      const k = scale / v.scale
      return { scale, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k }
    })
  }, [])

  // ---------------- Canvas: pan / pinch ----------------
  const onCanvasPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-ui]')) return
    containerRef.current!.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, toLocal(e))
    if (pointers.current.size === 1) {
      pan.current = { start: toLocal(e), vp: vpRef.current }
      if (!drag.current) {
        setSelected(null)
        setEditing(null)
        setConnectFrom(null)
      }
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y), mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, vp: vpRef.current }
      pan.current = null
      cancelDrag()
    }
  }

  const onCanvasPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (drag.current && drag.current.pointerId === e.pointerId) return moveDrag(e)
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, toLocal(e))
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const { d0, mid0, vp: v0 } = pinch.current
      const scale = clamp(v0.scale * (d / d0), MIN_SCALE, MAX_SCALE)
      const wx = (mid0.x - v0.x) / v0.scale
      const wy = (mid0.y - v0.y) / v0.scale
      setVp({ scale, x: mid.x - wx * scale, y: mid.y - wy * scale })
    } else if (pan.current) {
      const p = toLocal(e)
      setVp({ ...pan.current.vp, x: pan.current.vp.x + p.x - pan.current.start.x, y: pan.current.vp.y + p.y - pan.current.start.y })
    }
  }

  const onCanvasPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (drag.current && drag.current.pointerId === e.pointerId) endDrag()
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()]
      pan.current = { start: p, vp: vpRef.current }
    } else if (pointers.current.size === 0) pan.current = null
  }

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-ui], textarea')) return
    if (e.ctrlKey || e.metaKey) {
      zoomAt(toLocal(e), Math.exp(-e.deltaY * 0.01))
    } else {
      setVp((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
    }
  }

  // bloqueia o zoom do navegador (ctrl+wheel / gesto do trackpad) sobre o canvas
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const prevent = (e: Event) => e.preventDefault()
    el.addEventListener('wheel', prevent, { passive: false })
    el.addEventListener('gesturestart', prevent)
    return () => {
      el.removeEventListener('wheel', prevent)
      el.removeEventListener('gesturestart', prevent)
    }
  }, [board?.id])

  // ---------------- Itens: mover / redimensionar ----------------
  const itemsById = useMemo(() => new Map(board?.items.map((i) => [i.id, i]) ?? []), [board?.items])

  const onItemPointerDown = useCallback<ItemHandlers['onPointerDown']>(
    (e, item, mode) => {
      if (!board) return
      const target = e.target as HTMLElement
      if (target.closest('[data-nodrag], input, textarea, a, button')) {
        e.stopPropagation()
        return
      }
      if (editing === item.id && mode === 'move') {
        e.stopPropagation()
        return
      }
      e.stopPropagation()
      // segundo dedo sobre um item: deixa o canvas tratar o pinch
      if (pointers.current.size >= 1) return onCanvasPointerDown(e as RPointerEvent<HTMLDivElement>)

      containerRef.current!.setPointerCapture(e.pointerId)
      pointers.current.set(e.pointerId, toLocal(e))

      // modo conexão: toque em outro cartão cria/remove a ligação
      if (connectFrom && mode === 'move') {
        if (connectFrom !== item.id) toggleConnection(board.id, connectFrom, item.id)
        setConnectFrom(null)
        return
      }

      const origin: Record<string, Vec> = { [item.id]: { x: item.x, y: item.y } }
      // colunas carregam os cartões que estão dentro delas
      if (item.type === 'column' && mode === 'move') {
        const h = item.h ?? 300
        for (const other of board.items) {
          if (other.id === item.id || other.type === 'column') continue
          if (other.x >= item.x && other.x <= item.x + item.w && other.y >= item.y && other.y <= item.y + h) {
            origin[other.id] = { x: other.x, y: other.y }
          }
        }
      }
      drag.current = {
        mode, pointerId: e.pointerId, start: { x: e.clientX, y: e.clientY }, origin, itemId: item.id, moved: false,
        size: { w: item.w, h: item.h ?? sizes[item.id]?.h ?? 200 },
      }
      if (selected !== item.id) setEditing(null)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board, editing, connectFrom, selected, sizes],
  )

  const moveDrag = (e: RPointerEvent) => {
    const d = drag.current!
    const dx = (e.clientX - d.start.x) / vpRef.current.scale
    const dy = (e.clientY - d.start.y) / vpRef.current.scale
    if (!d.moved && Math.hypot(dx, dy) * vpRef.current.scale < 4) return
    d.moved = true
    if (d.mode === 'move') {
      const next: Record<string, Partial<BoardItem>> = {}
      for (const [iid, o] of Object.entries(d.origin)) next[iid] = { x: Math.round(o.x + dx), y: Math.round(o.y + dy) }
      setOverride(next)
    } else {
      const item = itemsById.get(d.itemId)!
      const patch: Partial<BoardItem> = { w: Math.max(140, Math.round(d.size!.w + dx)) }
      if (item.type === 'column' || item.type === 'image') patch.h = Math.max(100, Math.round(d.size!.h + dy))
      setOverride({ [d.itemId]: patch })
    }
  }

  const endDrag = () => {
    const d = drag.current
    drag.current = null
    if (!d || !board) return
    if (d.moved) {
      for (const [iid, patch] of Object.entries(override)) updateItem(board.id, iid, patch)
      setOverride({})
      setSelected(d.itemId)
      if (d.mode === 'move') bringToFront(board.id, d.itemId)
      return
    }
    // toque simples: seleciona; segundo toque (ou duplo clique) edita
    const now = Date.now()
    const item = itemsById.get(d.itemId)
    const isSecondTap = selected === d.itemId || (lastTap.current?.id === d.itemId && now - lastTap.current.t < 350)
    if (isSecondTap && item && item.type !== 'note') setEditing(d.itemId)
    else if (isSecondTap && item?.type === 'note' && item.noteId) navigate(`/notes/${item.noteId}`)
    setSelected(d.itemId)
    lastTap.current = { id: d.itemId, t: now }
  }

  const cancelDrag = () => {
    drag.current = null
    setOverride({})
  }

  const handlers = useMemo<ItemHandlers>(
    () => ({
      onPointerDown: onItemPointerDown,
      onChange: (iid, patch) => board && updateItem(board.id, iid, patch),
      onStopEditing: () => setEditing(null),
      onSize: (iid, w, h) =>
        setSizes((s) => (s[iid]?.w === w && s[iid]?.h === h ? s : { ...s, [iid]: { w, h } })),
    }),
    [onItemPointerDown, board, updateItem],
  )

  // ---------------- Ações ----------------
  const viewportCenter = (): Vec => {
    const r = containerRef.current?.getBoundingClientRect()
    const w = r?.width ?? 360
    const h = r?.height ?? 600
    return { x: (w / 2 - vp.x) / vp.scale, y: (h / 2 - vp.y) / vp.scale }
  }

  const add = (type: BoardItemType, extra: Partial<BoardItem> = {}) => {
    if (!board) return
    const c = viewportCenter()
    const jitter = () => Math.round((Math.random() - 0.5) * 40)
    const defaults: Record<BoardItemType, Partial<BoardItem>> = {
      text: { w: 220, color: '#ffffff', text: '' },
      note: { w: 240, color: '#dbeafe', text: '' },
      todo: { w: 240, color: '#dcfce7', text: 'Checklist', todos: [] },
      link: { w: 260, color: '#fef3c7', text: '' },
      image: { w: 240, h: 180, color: '#ffffff', text: '' },
      column: { w: 260, h: 360, color: '#ede9fe', text: 'Coluna' },
    }
    const base = { ...defaults[type], ...extra }
    const item = addItem(board.id, {
      type, x: Math.round(c.x - (base.w ?? 220) / 2 + jitter()), y: Math.round(c.y - 60 + jitter()),
      w: base.w ?? 220, h: base.h, color: base.color ?? '#ffffff', text: base.text ?? '', todos: base.todos, noteId: base.noteId,
    })
    setSelected(item.id)
    if (type !== 'note') setEditing(item.id)
  }

  const fit = () => {
    const el = containerRef.current
    if (!board || !el || board.items.length === 0) return setVp({ x: 40, y: 40, scale: 1 })
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const i of board.items) {
      const h = i.h ?? sizes[i.id]?.h ?? 120
      minX = Math.min(minX, i.x); minY = Math.min(minY, i.y)
      maxX = Math.max(maxX, i.x + i.w); maxY = Math.max(maxY, i.y + h)
    }
    const r = el.getBoundingClientRect()
    const pad = 40
    const scale = clamp(Math.min((r.width - pad * 2) / (maxX - minX), (r.height - pad * 2 - 80) / (maxY - minY)), MIN_SCALE, 1.5)
    setVp({ scale, x: (r.width - (maxX - minX) * scale) / 2 - minX * scale, y: pad + 50 - minY * scale })
  }

  // atalhos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!board || editing) return
      if ((e.target as HTMLElement).closest('input, textarea')) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        deleteItem(board.id, selected)
        setSelected(null)
      }
      if (e.key === 'Escape') { setSelected(null); setConnectFrom(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [board, selected, editing, deleteItem])

  if (!board) {
    return <EmptyState icon={<StickyNote />} title="Quadro não encontrado" action={<Link to="/boards" className="btn-primary">Ver quadros</Link>} />
  }

  const pos = (i: BoardItem) => ({ ...i, ...override[i.id] })
  const sel = selected ? itemsById.get(selected) : undefined
  const gridSize = 24 * vp.scale

  return (
    <div className="relative h-full overflow-hidden">
      {/* Topo */}
      <div data-ui className="pt-safe absolute inset-x-0 top-0 z-20 flex items-center gap-2 p-2">
        <button className="icon-btn bg-white/90 shadow-sm backdrop-blur dark:bg-ink-900/90" onClick={() => navigate('/boards')} aria-label="Voltar">
          <ArrowLeft size={18} />
        </button>
        <input
          className="min-w-0 flex-1 rounded-xl bg-white/90 px-3 py-2 font-semibold shadow-sm outline-none backdrop-blur dark:bg-ink-900/90"
          value={board.name}
          onChange={(e) => updateBoard(board.id, { name: e.target.value })}
          aria-label="Nome do quadro"
        />
        <div className="flex rounded-xl bg-white/90 shadow-sm backdrop-blur dark:bg-ink-900/90">
          <button className="icon-btn" onClick={() => zoomAt(viewportCenterScreen(containerRef.current), 1 / 1.2)} aria-label="Diminuir zoom"><ZoomOut size={18} /></button>
          <button className="w-12 text-xs font-medium tabular-nums" onClick={() => setVp((v) => ({ ...v, scale: 1 }))} title="Zoom 100%">{Math.round(vp.scale * 100)}%</button>
          <button className="icon-btn" onClick={() => zoomAt(viewportCenterScreen(containerRef.current), 1.2)} aria-label="Aumentar zoom"><ZoomIn size={18} /></button>
          <button className="icon-btn" onClick={fit} aria-label="Enquadrar tudo"><Maximize size={18} /></button>
        </div>
      </div>

      {/* Barra do item selecionado */}
      {sel && !drag.current && (
        <div data-ui className="absolute inset-x-0 top-[calc(56px+env(safe-area-inset-top))] z-20 flex justify-center px-2">
          <div className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-lg dark:bg-ink-900">
            {CARD_COLORS.concat(sel.type === 'text' ? ['transparent'] : []).map((c) => (
              <button
                key={c}
                onClick={() => updateItem(board.id, sel.id, { color: c })}
                className={cn('h-7 w-7 shrink-0 rounded-full border border-black/10', sel.color === c && 'ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-ink-900')}
                style={{ background: c === 'transparent' ? 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 50% / 8px 8px' : c }}
                aria-label={`Cor ${c}`}
              />
            ))}
            <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-white/10" />
            {sel.type !== 'note' && (
              <button className="icon-btn shrink-0" onClick={() => setEditing(sel.id)} aria-label="Editar"><Pencil size={16} /></button>
            )}
            {sel.type === 'note' && sel.noteId && (
              <Link className="icon-btn shrink-0" to={`/notes/${sel.noteId}`} aria-label="Abrir nota"><FileText size={16} /></Link>
            )}
            <button
              className={cn('icon-btn shrink-0', connectFrom === sel.id && '!bg-amber-400/20 !text-amber-600')}
              onClick={() => setConnectFrom(connectFrom ? null : sel.id)}
              aria-label="Conectar a outro cartão"
              title="Conectar: toque em outro cartão"
            >
              <Spline size={16} />
            </button>
            <button
              className="icon-btn shrink-0"
              onClick={() => {
                const { id: _omit, ...rest } = sel
                void _omit
                const copy = addItem(board.id, { ...rest, x: sel.x + 24, y: sel.y + 24, todos: sel.todos?.map((t) => ({ ...t })) })
                setSelected(copy.id)
              }}
              aria-label="Duplicar"
            >
              <Copy size={16} />
            </button>
            <button className="icon-btn shrink-0 hover:!text-red-500" onClick={() => { deleteItem(board.id, sel.id); setSelected(null) }} aria-label="Excluir cartão">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}
      {connectFrom && (
        <div data-ui className="absolute inset-x-0 top-[calc(108px+env(safe-area-inset-top))] z-20 text-center">
          <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-amber-950 shadow">Toque em outro cartão para conectar/desconectar</span>
        </div>
      )}

      {/* Canvas infinito */}
      <div
        ref={containerRef}
        className="board-grid absolute inset-0 touch-none"
        style={{ backgroundSize: `${gridSize}px ${gridSize}px`, backgroundPosition: `${vp.x}px ${vp.y}px` }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerUp}
        onWheel={onWheel}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement) !== containerRef.current && !(e.target as HTMLElement).dataset.world) return
          const p = toLocal(e)
          const wx = (p.x - vp.x) / vp.scale
          const wy = (p.y - vp.y) / vp.scale
          const item = addItem(board.id, { type: 'text', x: Math.round(wx - 110), y: Math.round(wy - 20), w: 220, color: '#ffffff', text: '' })
          setSelected(item.id)
          setEditing(item.id)
        }}
      >
        <div data-world="1" className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.scale})` }}>
          {/* conexões */}
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1">
            {board.connections.map((c) => {
              const a = itemsById.get(c.from)
              const b = itemsById.get(c.to)
              if (!a || !b) return null
              const pa = pos(a), pb = pos(b)
              const sa = sizes[a.id] ?? { w: pa.w, h: 80 }
              const sb = sizes[b.id] ?? { w: pb.w, h: 80 }
              const x1 = pa.x + sa.w / 2, y1 = pa.y + sa.h / 2
              const x2 = pb.x + sb.w / 2, y2 = pb.y + sb.h / 2
              const mx = (x1 + x2) / 2
              return (
                <path
                  key={c.id}
                  d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  className="stroke-slate-400 dark:stroke-slate-500"
                  strokeWidth={2 / Math.max(vp.scale, 0.5)}
                  strokeDasharray="6 4"
                />
              )
            })}
          </svg>
          {/* colunas primeiro (ficam atrás dos cartões) */}
          {[...board.items].sort((a, b) => Number(b.type === 'column') - Number(a.type === 'column')).map((i) => {
            const p = pos(i)
            return (
              <BoardItemView
                key={i.id}
                item={p}
                x={p.x}
                y={p.y}
                selected={selected === i.id}
                editing={editing === i.id}
                connectSource={connectFrom === i.id}
                handlers={handlers}
              />
            )
          })}
        </div>

        {board.items.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-slate-400">
            Quadro vazio — adicione cartões pela barra abaixo<br />ou dê um duplo clique no fundo.<br />Arraste o fundo para mover · pinça/ctrl+scroll para zoom
          </div>
        )}
      </div>

      {/* Barra de criação */}
      <div data-ui className="absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
        <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-xl dark:bg-ink-900">
          {[
            { t: 'text' as const, icon: Type, label: 'Texto' },
            { t: 'note' as const, icon: FileText, label: 'Nota' },
            { t: 'todo' as const, icon: CheckSquare, label: 'Checklist' },
            { t: 'link' as const, icon: Link2, label: 'Link' },
            { t: 'image' as const, icon: ImageIcon, label: 'Imagem' },
            { t: 'column' as const, icon: Columns3, label: 'Coluna' },
          ].map(({ t, icon: Icon, label }) => (
            <button
              key={t}
              onClick={() => (t === 'note' ? setNotePicker(true) : add(t))}
              className="flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 active:scale-95 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <NotePicker
        open={notePicker}
        onClose={() => setNotePicker(false)}
        onPick={(noteId) => { add('note', { noteId }); setNotePicker(false) }}
        onCreate={(title) => { const n = createNote(title, `# ${title}\n\n`); add('note', { noteId: n.id }); setNotePicker(false) }}
      />
    </div>
  )
}

function viewportCenterScreen(el: HTMLDivElement | null): Vec {
  const r = el?.getBoundingClientRect()
  return { x: (r?.width ?? 0) / 2, y: (r?.height ?? 0) / 2 }
}

function NotePicker({ open, onClose, onPick, onCreate }: {
  open: boolean; onClose: () => void; onPick: (id: string) => void; onCreate: (title: string) => void
}) {
  const notes = useNotes((s) => s.notes)
  const [q, setQ] = useState('')
  const list = notes.filter((n) => n.title.toLowerCase().includes(q.toLowerCase())).slice(0, 30)
  return (
    <Sheet open={open} onClose={onClose} title="Adicionar nota ao quadro">
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar ou criar nota…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div className="space-y-1">
        {q.trim() && !notes.some((n) => n.title.toLowerCase() === q.trim().toLowerCase()) && (
          <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-brand-600 hover:bg-brand-500/10 dark:text-brand-400" onClick={() => { onCreate(q.trim()); setQ('') }}>
            <FileText size={16} /> Criar “{q.trim()}”
          </button>
        )}
        {list.map((n) => (
          <button key={n.id} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => { onPick(n.id); setQ('') }}>
            <FileText size={16} className="text-slate-400" /> {n.title}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
