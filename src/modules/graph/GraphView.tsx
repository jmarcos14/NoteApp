import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { Crosshair, ExternalLink, Search, Settings, SlidersHorizontal, X } from 'lucide-react'
import { useNotes } from '../../store/notes'
import { useProjects } from '../../store/projects'
import { useBoards } from '../../store/boards'
import { extractLinkTitles, normalizeTitle } from '../../lib/wikilinks'
import { clamp, cn } from '../../lib/utils'

type NodeKind = 'note' | 'project' | 'board' | 'tag' | 'ghost'

interface GNode extends SimulationNodeDatum {
  id: string // "<kind>:<id>"
  kind: NodeKind
  label: string
  ref: string
  color?: string
  degree: number
}
interface GLink extends SimulationLinkDatum<GNode> {
  source: string | GNode
  target: string | GNode
  kind: 'link' | 'project' | 'board' | 'tag' | 'task'
}

const KIND_META: Record<NodeKind, { label: string; color: string }> = {
  note: { label: 'Notas', color: '#6366f1' },
  project: { label: 'Projetos', color: '#f97316' },
  board: { label: 'Quadros', color: '#14b8a6' },
  tag: { label: 'Tags', color: '#22c55e' },
  ghost: { label: 'Não criadas', color: '#94a3b8' },
}

const radius = (n: GNode) => (n.kind === 'project' ? 10 : n.kind === 'tag' ? 5 : 6) + Math.sqrt(n.degree) * 2.6
const idOf = (x: string | GNode) => (typeof x === 'string' ? x : x.id)

export default function GraphView() {
  const notes = useNotes((s) => s.notes)
  const { projects, tasks } = useProjects()
  const boards = useBoards((s) => s.boards)
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [filters, setFilters] = useState<Record<NodeKind, boolean>>({ note: true, project: true, board: true, tag: false, ghost: true })
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<string | null>(params.get('focus'))
  const [query, setQuery] = useState('')
  const [, setFrame] = useState(0)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const viewRef = useRef(view)
  viewRef.current = view

  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<Simulation<GNode, GLink> | null>(null)
  const nodesRef = useRef<GNode[]>([])
  const linksRef = useRef<GLink[]>([])
  const fitted = useRef(false)

  // ---------- monta o grafo ----------
  const graph = useMemo(() => {
    const nodes = new Map<string, GNode>()
    const links: GLink[] = []
    const seen = new Set<string>()
    const add = (n: Omit<GNode, 'degree'>) => {
      if (!filters[n.kind]) return false
      if (!nodes.has(n.id)) nodes.set(n.id, { ...n, degree: 0 })
      return true
    }
    const link = (a: string, b: string, kind: GLink['kind']) => {
      if (a === b || !nodes.has(a) || !nodes.has(b)) return
      const key = [a, b].sort().join('|')
      if (seen.has(key)) return
      seen.add(key)
      links.push({ source: a, target: b, kind })
      nodes.get(a)!.degree++
      nodes.get(b)!.degree++
    }

    const noteByTitle = new Map(notes.map((n) => [normalizeTitle(n.title), n]))
    const projByTitle = new Map(projects.map((p) => [normalizeTitle(p.name), p]))

    notes.forEach((n) => add({ id: `note:${n.id}`, kind: 'note', label: n.title, ref: n.id }))
    projects.forEach((p) => add({ id: `project:${p.id}`, kind: 'project', label: p.name, ref: p.id, color: p.color }))
    boards.forEach((b) => add({ id: `board:${b.id}`, kind: 'board', label: `${b.emoji} ${b.name}`, ref: b.id }))

    for (const n of notes) {
      const from = `note:${n.id}`
      for (const title of extractLinkTitles(n.content)) {
        const key = normalizeTitle(title)
        const tn = noteByTitle.get(key)
        const tp = projByTitle.get(key)
        if (tn) link(from, `note:${tn.id}`, 'link')
        else if (tp) link(from, `project:${tp.id}`, 'project')
        else if (add({ id: `ghost:${key}`, kind: 'ghost', label: title, ref: title })) link(from, `ghost:${key}`, 'link')
      }
      for (const t of n.tags) if (add({ id: `tag:${t}`, kind: 'tag', label: `#${t}`, ref: t })) link(from, `tag:${t}`, 'tag')
    }
    for (const t of tasks) if (t.noteId && t.projectId) link(`note:${t.noteId}`, `project:${t.projectId}`, 'task')
    for (const b of boards) {
      if (b.projectId) link(`board:${b.id}`, `project:${b.projectId}`, 'board')
      for (const i of b.items) if (i.noteId) link(`board:${b.id}`, `note:${i.noteId}`, 'board')
    }
    return { nodes: [...nodes.values()], links }
  }, [notes, projects, boards, tasks, filters])

  // ---------- simulação de forças ----------
  useEffect(() => {
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]))
    const nodes = graph.nodes.map((n) => {
      const p = prev.get(n.id)
      return p ? { ...n, x: p.x, y: p.y, vx: p.vx, vy: p.vy } : { ...n }
    })
    const links = graph.links.map((l) => ({ ...l }))
    nodesRef.current = nodes
    linksRef.current = links

    simRef.current?.stop()
    const sim = buildSimulation(nodes, links)
    simRef.current = sim
    const isNew = prev.size === 0
    if (isNew) {
      sim.stop()
      for (let i = 0; i < 200; i++) sim.tick()
      sim.alpha(0.05)
    } else sim.alpha(0.5)

    let raf = 0
    sim.on('tick', () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setFrame((f) => f + 1))
    })
    sim.restart()
    if (!fitted.current) {
      fitted.current = true
      requestAnimationFrame(() => {
        const focus = params.get('focus')
        if (focus && nodes.some((n) => n.id === focus)) centerOn(focus, 1.4)
        else fit()
      })
    }
    setFrame((f) => f + 1)
    return () => {
      sim.stop()
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph])

  // ---------- vizinhança do selecionado / busca ----------
  const neighbors = useMemo(() => {
    const s = new Set<string>()
    if (!selected) return s
    s.add(selected)
    for (const l of graph.links) {
      const a = idOf(l.source), b = idOf(l.target)
      if (a === selected) s.add(b)
      if (b === selected) s.add(a)
    }
    return s
  }, [selected, graph.links])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return graph.nodes.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 6)
  }, [query, graph.nodes])

  // ---------- câmera ----------
  const size = () => {
    const r = svgRef.current?.getBoundingClientRect()
    return { w: r?.width ?? 360, h: r?.height ?? 600, left: r?.left ?? 0, top: r?.top ?? 0 }
  }
  function fit() {
    const ns = nodesRef.current
    if (!ns.length) return
    const { w, h } = size()
    const xs = ns.map((n) => n.x ?? 0), ys = ns.map((n) => n.y ?? 0)
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
    const k = clamp(Math.min((w - 80) / (maxX - minX || 1), (h - 200) / (maxY - minY || 1)), 0.2, 2)
    setView({ k, x: w / 2 - ((minX + maxX) / 2) * k, y: h / 2 - ((minY + maxY) / 2) * k })
  }
  function centerOn(id: string, k = viewRef.current.k) {
    const n = nodesRef.current.find((x) => x.id === id)
    if (!n) return
    const { w, h } = size()
    setView({ k, x: w / 2 - (n.x ?? 0) * k, y: h / 2.4 - (n.y ?? 0) * k })
  }

  // ---------- interação: pan / pinch / arrastar nó ----------
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<
    | { type: 'pan'; start: { x: number; y: number }; view: typeof view }
    | { type: 'pinch'; d0: number; mid0: { x: number; y: number }; view: typeof view }
    | { type: 'node'; node: GNode; start: { x: number; y: number }; moved: boolean }
    | null
  >(null)
  const lastTap = useRef<{ id: string; t: number } | null>(null)

  const local = (e: { clientX: number; clientY: number }) => {
    const { left, top } = size()
    return { x: e.clientX - left, y: e.clientY - top }
  }

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    svgRef.current!.setPointerCapture(e.pointerId)
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    const nodeId = (e.target as Element).closest('[data-node]')?.getAttribute('data-node')
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      if (gesture.current?.type === 'node') releaseNode(gesture.current.node)
      gesture.current = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: viewRef.current }
    } else if (nodeId) {
      const node = nodesRef.current.find((n) => n.id === nodeId)!
      gesture.current = { type: 'node', node, start: p, moved: false }
    } else {
      gesture.current = { type: 'pan', start: p, view: viewRef.current }
    }
  }

  const releaseNode = (n: GNode) => {
    n.fx = null
    n.fy = null
    simRef.current?.alphaTarget(0)
  }

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    const g = gesture.current
    if (!g) return
    if (g.type === 'pan') {
      setView({ ...g.view, x: g.view.x + p.x - g.start.x, y: g.view.y + p.y - g.start.y })
    } else if (g.type === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const k = clamp(g.view.k * (d / g.d0), 0.15, 4)
      const wx = (g.mid0.x - g.view.x) / g.view.k, wy = (g.mid0.y - g.view.y) / g.view.k
      setView({ k, x: mid.x - wx * k, y: mid.y - wy * k })
    } else if (g.type === 'node') {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < 5) return
      if (!g.moved) simRef.current?.alphaTarget(0.3).restart()
      g.moved = true
      const v = viewRef.current
      g.node.fx = (p.x - v.x) / v.k
      g.node.fy = (p.y - v.y) / v.k
    }
  }

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (g?.type === 'node') {
      releaseNode(g.node)
      if (!g.moved) {
        const now = Date.now()
        if (selected === g.node.id && lastTap.current?.id === g.node.id && now - lastTap.current.t < 400) open(g.node)
        setSelected(g.node.id)
        if (selected !== g.node.id) centerOn(g.node.id)
        lastTap.current = { id: g.node.id, t: now }
      }
    } else if (g?.type === 'pan' && pointers.current.size === 0) {
      const moved = Math.hypot(local(e).x - g.start.x, local(e).y - g.start.y)
      if (moved < 5) setSelected(null)
    }
    if (pointers.current.size === 1 && g?.type === 'pinch') {
      const [p] = [...pointers.current.values()]
      gesture.current = { type: 'pan', start: p, view: viewRef.current }
    } else if (pointers.current.size === 0) gesture.current = null
  }

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    const p = local(e)
    setView((v) => {
      const k = clamp(v.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), 0.15, 4)
      return { k, x: p.x - (p.x - v.x) * (k / v.k), y: p.y - (p.y - v.y) * (k / v.k) }
    })
  }

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const prevent = (e: Event) => e.preventDefault()
    el.addEventListener('wheel', prevent, { passive: false })
    return () => el.removeEventListener('wheel', prevent)
  }, [])

  function open(n: GNode) {
    if (n.kind === 'note') navigate(`/notes/${n.ref}`)
    else if (n.kind === 'project') navigate(`/projects/${n.ref}`)
    else if (n.kind === 'board') navigate(`/boards/${n.ref}`)
    else if (n.kind === 'tag') navigate('/notes')
    else if (n.kind === 'ghost') {
      const created = useNotes.getState().createNote(n.label, `# ${n.label}\n\n`)
      navigate(`/notes/${created.id}?edit=1`)
    }
  }

  const sel = selected ? nodesRef.current.find((n) => n.id === selected) : undefined
  const selNeighbors = sel ? nodesRef.current.filter((n) => n.id !== sel.id && neighbors.has(n.id)) : []
  const showLabels = view.k > 0.7

  return (
    <div className="relative h-full overflow-hidden bg-slate-50 dark:bg-ink-950">
      {/* topo */}
      <div className="pt-safe absolute inset-x-0 top-0 z-10 p-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" />
            <input
              className="input !bg-white/90 pl-9 shadow-sm backdrop-blur dark:!bg-ink-900/90"
              placeholder="Buscar no grafo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {matches.length > 0 && (
              <div className="card absolute inset-x-0 top-full mt-1 overflow-hidden p-1 shadow-xl">
                {matches.map((m) => (
                  <button
                    key={m.id}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-white/5"
                    onClick={() => { setSelected(m.id); centerOn(m.id, Math.max(1.2, view.k)); setQuery('') }}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color ?? KIND_META[m.kind].color }} />
                    <span className="flex-1 truncate">{m.label}</span>
                    <span className="text-[10px] text-slate-400">{KIND_META[m.kind].label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className={cn('icon-btn bg-white/90 shadow-sm dark:bg-ink-900/90', showFilters && '!text-brand-500')} onClick={() => setShowFilters(!showFilters)} aria-label="Filtros">
            <SlidersHorizontal size={18} />
          </button>
          <button className="icon-btn bg-white/90 shadow-sm dark:bg-ink-900/90" onClick={fit} aria-label="Enquadrar"><Crosshair size={18} /></button>
          <Link to="/settings" className="icon-btn bg-white/90 shadow-sm md:hidden dark:bg-ink-900/90" aria-label="Configurações"><Settings size={18} /></Link>
        </div>
        {showFilters && (
          <div className="no-scrollbar mx-auto mt-2 flex max-w-2xl gap-2 overflow-x-auto">
            {(Object.keys(KIND_META) as NodeKind[]).map((k) => (
              <button key={k} onClick={() => setFilters({ ...filters, [k]: !filters[k] })} className={cn('chip bg-white/90 dark:bg-ink-900/90', filters[k] && 'chip-active')}>
                <span className="h-2 w-2 rounded-full" style={{ background: KIND_META[k].color }} /> {KIND_META[k].label}
              </button>
            ))}
          </div>
        )}
      </div>

      <svg
        ref={svgRef}
        className="h-full w-full touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {linksRef.current.map((l, i) => {
            const s = l.source as GNode, t = l.target as GNode
            if (s.x == null || t.x == null) return null
            const active = selected && (s.id === selected || t.id === selected)
            const dim = selected && !active
            return (
              <line
                key={i}
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                className={cn(active ? 'stroke-brand-500' : 'stroke-slate-300 dark:stroke-slate-700')}
                strokeOpacity={dim ? 0.25 : 1}
                strokeWidth={(active ? 2 : 1.2) / Math.max(view.k, 0.6)}
                strokeDasharray={l.kind === 'tag' || l.kind === 'board' ? '3 3' : undefined}
              />
            )
          })}
          {nodesRef.current.map((n) => {
            if (n.x == null) return null
            const r = radius(n)
            const dim = selected && !neighbors.has(n.id)
            const isSel = selected === n.id
            const color = n.kind === 'project' ? (n.color ?? KIND_META.project.color) : KIND_META[n.kind].color
            return (
              <g key={n.id} data-node={n.id} transform={`translate(${n.x},${n.y})`} opacity={dim ? 0.2 : 1} className="cursor-pointer">
                {isSel && <circle r={r + 6} fill={color} opacity={0.2} />}
                {n.kind === 'project' ? (
                  <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={4} fill={color} />
                ) : n.kind === 'board' ? (
                  <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.5} fill={color} transform="rotate(45)" />
                ) : (
                  <circle r={r} fill={n.kind === 'ghost' ? 'transparent' : color} stroke={color} strokeWidth={n.kind === 'ghost' ? 1.5 : 0} strokeDasharray={n.kind === 'ghost' ? '2 2' : undefined} />
                )}
                {(showLabels || isSel || n.degree > 3 || (selected && neighbors.has(n.id))) && (
                  <text
                    y={r + 12 / Math.max(view.k, 0.8)}
                    textAnchor="middle"
                    fontSize={11 / Math.max(view.k, 0.8)}
                    className={cn('pointer-events-none fill-slate-600 dark:fill-slate-300', isSel && 'font-semibold')}
                    style={{ paintOrder: 'stroke' }}
                    stroke="var(--label-halo)"
                    strokeWidth={3 / Math.max(view.k, 0.8)}
                  >
                    {n.label.length > 24 ? n.label.slice(0, 22) + '…' : n.label}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* legenda */}
      {!sel && (
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-xl bg-white/80 p-2 text-[11px] backdrop-blur dark:bg-ink-900/80">
          {(Object.keys(KIND_META) as NodeKind[]).filter((k) => filters[k]).map((k) => (
            <span key={k} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: KIND_META[k].color }} /> {KIND_META[k].label}</span>
          ))}
          <span className="mt-1 text-slate-400">{graph.nodes.length} nós · {graph.links.length} conexões</span>
        </div>
      )}

      {/* painel do nó selecionado */}
      {sel && (
        <div className="absolute inset-x-3 bottom-3 z-10 mx-auto max-w-md">
          <div className="card p-4 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: sel.color ?? KIND_META[sel.kind].color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{sel.label}</p>
                <p className="text-xs text-slate-500">{KIND_META[sel.kind].label.replace(/s$/, '')} · {sel.degree} conexões</p>
              </div>
              <button className="icon-btn !h-8 !w-8" onClick={() => setSelected(null)} aria-label="Fechar"><X size={16} /></button>
            </div>
            {selNeighbors.length > 0 && (
              <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
                {selNeighbors.map((n) => (
                  <button key={n.id} className="chip shrink-0" onClick={() => { setSelected(n.id); centerOn(n.id) }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: n.color ?? KIND_META[n.kind].color }} /> {n.label}
                  </button>
                ))}
              </div>
            )}
            <button className="btn-primary mt-3 w-full" onClick={() => open(sel)}>
              <ExternalLink size={16} /> {sel.kind === 'ghost' ? 'Criar nota' : 'Abrir'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function buildSimulation(nodes: GNode[], links: GLink[]) {
  return forceSimulation<GNode, GLink>(nodes)
    .force('link', forceLink<GNode, GLink>(links).id((d) => d.id).distance((l) => (l.kind === 'tag' ? 40 : 70)).strength(0.6))
    .force('charge', forceManyBody<GNode>().strength(-240).distanceMax(500))
    .force('collide', forceCollide<GNode>().radius((d) => radius(d) + 6))
    .force('center', forceCenter(0, 0).strength(0.05))
    .force('x', forceX<GNode>(0).strength(0.04))
    .force('y', forceY<GNode>(0).strength(0.04))
}
