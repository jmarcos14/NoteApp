import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, MoreVertical, Plus, Settings } from 'lucide-react'
import { EmptyState, Fab, PageHeader, Sheet, confirmAction } from '../../components/ui'
import { useBoards } from '../../store/boards'
import { useProjects } from '../../store/projects'
import { cn, relativeTime } from '../../lib/utils'
import type { Board } from '../../types'

const EMOJIS = ['🗂️', '💡', '🎨', '🏔️', '🛋️', '📚', '🚀', '🎯', '🧠', '🎬', '🍳', '✈️']

export default function BoardsList() {
  const boards = useBoards((s) => s.boards)
  const projects = useProjects((s) => s.projects)
  const navigate = useNavigate()
  const [sheet, setSheet] = useState<Partial<Board> | null>(null)

  return (
    <>
      <PageHeader
        title="Quadros"
        subtitle="Canvas infinito para organizar ideias visualmente"
        actions={<Link to="/settings" className="icon-btn md:hidden" aria-label="Configurações"><Settings size={18} /></Link>}
      />
      <div className="mx-auto max-w-5xl px-4 py-4">
        {boards.length === 0 ? (
          <EmptyState icon={<LayoutDashboard />} title="Nenhum quadro" text="Crie um quadro para organizar cartões, notas, checklists e links." action={<button className="btn-primary" onClick={() => setSheet({})}><Plus size={16} /> Novo quadro</button>} />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {boards.map((b) => {
              const project = projects.find((p) => p.id === b.projectId)
              return (
                <div key={b.id} className="card group relative overflow-hidden">
                  <Link to={`/boards/${b.id}`} className="block">
                    <BoardThumb board={b} />
                    <div className="p-3">
                      <p className="truncate font-semibold">{b.emoji} {b.name}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {b.items.length} cartões · {relativeTime(b.updatedAt)}
                      </p>
                      {project && (
                        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: project.color }} /> {project.name}
                        </p>
                      )}
                    </div>
                  </Link>
                  <button className="icon-btn absolute right-1 top-1 bg-white/70 backdrop-blur dark:bg-ink-900/70" onClick={() => setSheet(b)} aria-label="Opções do quadro">
                    <MoreVertical size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Fab label="Novo quadro" icon={<Plus size={26} />} onClick={() => setSheet({})} />
      {sheet && <BoardSheet value={sheet} onClose={() => setSheet(null)} onCreated={(b) => navigate(`/boards/${b.id}`)} />}
    </>
  )
}

/** Miniatura com a disposição real dos cartões */
function BoardThumb({ board }: { board: Board }) {
  if (board.items.length === 0) return <div className="board-grid h-28" style={{ backgroundSize: '12px 12px' }} />
  const xs = board.items.map((i) => [i.x, i.x + i.w])
  const ys = board.items.map((i) => [i.y, i.y + (i.h ?? 110)])
  const minX = Math.min(...xs.flat()), maxX = Math.max(...xs.flat())
  const minY = Math.min(...ys.flat()), maxY = Math.max(...ys.flat())
  const w = maxX - minX || 1, h = maxY - minY || 1
  return (
    <div className="board-grid relative h-28 overflow-hidden" style={{ backgroundSize: '12px 12px' }}>
      <svg viewBox={`${minX - 20} ${minY - 20} ${w + 40} ${h + 40}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {[...board.items].sort((a, b) => Number(b.type === 'column') - Number(a.type === 'column')).map((i) => (
          <rect
            key={i.id}
            x={i.x} y={i.y} width={i.w} height={i.h ?? 110} rx={12}
            fill={i.color === 'transparent' ? 'none' : i.color}
            stroke="rgba(0,0,0,.08)" strokeWidth={2}
          />
        ))}
      </svg>
    </div>
  )
}

function BoardSheet({ value, onClose, onCreated }: { value: Partial<Board>; onClose: () => void; onCreated: (b: Board) => void }) {
  const { createBoard, updateBoard, deleteBoard } = useBoards()
  const projects = useProjects((s) => s.projects)
  const [name, setName] = useState(value.name ?? '')
  const [emoji, setEmoji] = useState(value.emoji ?? EMOJIS[0])
  const [projectId, setProjectId] = useState(value.projectId ?? '')
  const save = () => {
    if (!name.trim()) return
    if (value.id) updateBoard(value.id, { name: name.trim(), emoji, projectId: projectId || undefined })
    else onCreated(createBoard(name.trim(), emoji, projectId || undefined))
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={value.id ? 'Editar quadro' : 'Novo quadro'}
      footer={
        <div className="flex gap-2">
          {value.id && <button className="btn-danger" onClick={() => { if (confirmAction('Excluir quadro?')) { deleteBoard(value.id!); onClose() } }}>Excluir</button>}
          <button className="btn-primary flex-1" onClick={save}>{value.id ? 'Salvar' : 'Criar'}</button>
        </div>
      }>
      <div className="space-y-4">
        <div><label className="label">Nome</label><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} /></div>
        <div>
          <span className="label">Ícone</span>
          <div className="flex flex-wrap gap-1">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setEmoji(e)} className={cn('h-10 w-10 rounded-xl text-xl', emoji === e ? 'bg-brand-500/15 ring-2 ring-brand-500' : 'hover:bg-slate-100 dark:hover:bg-white/5')}>{e}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Projeto (opcional)</label>
          <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Nenhum</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
    </Sheet>
  )
}
