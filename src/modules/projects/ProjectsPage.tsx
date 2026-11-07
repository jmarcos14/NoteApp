import { useMemo, useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Calendar, FileText, Flag, LayoutDashboard, Network, Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import { ColorPicker, PageHeader, Segmented, Sheet, confirmAction } from '../../components/ui'
import { useProjects } from '../../store/projects'
import { useNotes } from '../../store/notes'
import { useBoards } from '../../store/boards'
import { backlinksFor } from '../../lib/wikilinks'
import { PALETTE, cn, dateLabel, isoDate } from '../../lib/utils'
import type { Priority, Project, Task, TaskStatus } from '../../types'

const COLUMNS: { id: TaskStatus; label: string; dot: string }[] = [
  { id: 'todo', label: 'A fazer', dot: 'bg-slate-400' },
  { id: 'doing', label: 'Em andamento', dot: 'bg-amber-500' },
  { id: 'done', label: 'Concluído', dot: 'bg-emerald-500' },
]

const PRIORITY: Record<Priority, { label: string; cls: string }> = {
  low: { label: 'Baixa', cls: 'text-slate-400' },
  medium: { label: 'Média', cls: 'text-amber-500' },
  high: { label: 'Alta', cls: 'text-red-500' },
}

export default function ProjectsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { projects, tasks, moveTask } = useProjects()
  const notes = useNotes((s) => s.notes)
  const boards = useBoards((s) => s.boards)
  const project = projects.find((p) => p.id === id)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [taskSheet, setTaskSheet] = useState<Partial<Task> | null>(null)
  const [projSheet, setProjSheet] = useState<Partial<Project> | null>(null)
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null)
  const dragId = useRef<string | null>(null)

  const filtered = useMemo(
    () => tasks.filter((t) => !id || t.projectId === id).sort((a, b) => a.order - b.order),
    [tasks, id],
  )
  const byStatus = (s: TaskStatus) => filtered.filter((t) => t.status === s)
  const done = filtered.filter((t) => t.status === 'done').length
  const projectNotes = project ? backlinksFor(project.name, notes) : []
  const projectBoards = project ? boards.filter((b) => b.projectId === project.id) : []

  const onDrop = (e: DragEvent, status: TaskStatus, beforeId?: string) => {
    e.preventDefault()
    e.stopPropagation()
    const tid = dragId.current ?? e.dataTransfer.getData('text/plain')
    if (tid) moveTask(tid, status, beforeId)
    dragId.current = null
    setDragOver(null)
  }

  return (
    <>
      <PageHeader
        title={project ? project.name : 'Tarefas'}
        subtitle={`${filtered.length} tarefas · ${filtered.length ? Math.round((done / filtered.length) * 100) : 0}% concluído`}
        actions={
          <>
            {project && (
              <>
                <Link className="icon-btn" to={`/graph?focus=project:${project.id}`} aria-label="Ver no grafo"><Network size={18} /></Link>
                <button className="icon-btn" onClick={() => setProjSheet(project)} aria-label="Editar projeto"><Pencil size={18} /></button>
              </>
            )}
            <Link to="/settings" className="icon-btn md:hidden" aria-label="Configurações"><Settings size={18} /></Link>
          </>
        }
      >
        <div className="mx-auto max-w-6xl space-y-2 px-4 pb-3">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            <button className={cn('chip', !id && 'chip-active')} onClick={() => navigate('/projects')}>Todas</button>
            {projects.map((p) => (
              <button key={p.id} className={cn('chip', id === p.id && 'chip-active')} onClick={() => navigate(`/projects/${p.id}`)}>
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} /> {p.name}
              </button>
            ))}
            <button className="chip border-dashed" onClick={() => setProjSheet({})}><Plus size={12} /> Projeto</button>
          </div>
          <Segmented value={view} onChange={setView} options={[{ value: 'kanban', label: 'Kanban' }, { value: 'list', label: 'Lista' }]} className="max-w-xs" />
        </div>
      </PageHeader>

      <div className="mx-auto max-w-6xl py-4">
        {project && (project.description || projectNotes.length > 0 || projectBoards.length > 0) && (
          <div className="mx-4 mb-4 space-y-2">
            {project.description && <p className="text-sm text-slate-500 dark:text-slate-400">{project.description}</p>}
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {projectNotes.map((n) => (
                <Link key={n.id} to={`/notes/${n.id}`} className="chip"><FileText size={12} /> {n.title}</Link>
              ))}
              {projectBoards.map((b) => (
                <Link key={b.id} to={`/boards/${b.id}`} className="chip"><LayoutDashboard size={12} /> {b.emoji} {b.name}</Link>
              ))}
            </div>
          </div>
        )}

        {view === 'kanban' ? (
          <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:grid md:grid-cols-3 md:overflow-visible">
            {COLUMNS.map((col) => {
              const list = byStatus(col.id)
              return (
                <section
                  key={col.id}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(col.id) }}
                  onDragLeave={() => setDragOver((d) => (d === col.id ? null : d))}
                  onDrop={(e) => onDrop(e, col.id)}
                  className={cn(
                    'flex w-[82vw] max-w-sm shrink-0 snap-center flex-col rounded-2xl bg-slate-100/80 p-2 transition md:w-auto md:max-w-none dark:bg-white/[.03]',
                    dragOver === col.id && 'ring-2 ring-brand-500/50',
                  )}
                >
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <span className={cn('h-2 w-2 rounded-full', col.dot)} />
                    <h2 className="flex-1 text-sm font-semibold">{col.label}</h2>
                    <span className="text-xs text-slate-400">{list.length}</span>
                    <button className="icon-btn !h-7 !w-7" onClick={() => setTaskSheet({ status: col.id, projectId: id })} aria-label={`Adicionar em ${col.label}`}>
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="min-h-24 flex-1 space-y-2">
                    {list.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        showProject={!id}
                        onOpen={() => setTaskSheet(t)}
                        onDragStart={(e) => { dragId.current = t.id; e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move' }}
                        onDrop={(e) => onDrop(e, col.id, t.id)}
                        onMove={(s) => moveTask(t.id, s)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="mx-4 space-y-4">
            {COLUMNS.map((col) => (
              <section key={col.id}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><span className={cn('h-2 w-2 rounded-full', col.dot)} /> {col.label}</h2>
                <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-white/5">
                  {byStatus(col.id).map((t) => <TaskRow key={t.id} task={t} onOpen={() => setTaskSheet(t)} />)}
                  {byStatus(col.id).length === 0 && <p className="p-4 text-center text-xs text-slate-400">Vazio</p>}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setTaskSheet({ status: 'todo', projectId: id })}
        aria-label="Nova tarefa"
        className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30 active:scale-95 md:bottom-6"
      >
        <Plus size={26} />
      </button>

      {taskSheet && <TaskSheet value={taskSheet} onClose={() => setTaskSheet(null)} />}
      {projSheet && (
        <ProjectSheet
          value={projSheet}
          onClose={() => setProjSheet(null)}
          onCreated={(p) => navigate(`/projects/${p.id}`)}
          onDeleted={() => navigate('/projects')}
        />
      )}
    </>
  )
}

function TaskCard({ task, showProject, onOpen, onDragStart, onDrop, onMove }: {
  task: Task
  showProject: boolean
  onOpen: () => void
  onDragStart: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
  onMove: (s: TaskStatus) => void
}) {
  const project = useProjects((s) => s.projects.find((p) => p.id === task.projectId))
  const note = useNotes((s) => s.notes.find((n) => n.id === task.noteId))
  const overdue = task.due && task.status !== 'done' && task.due < isoDate()
  const idx = COLUMNS.findIndex((c) => c.id === task.status)

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={onOpen}
      className="card cursor-grab p-3 transition hover:border-brand-500/40 active:cursor-grabbing"
    >
      <p className={cn('text-sm font-medium', task.status === 'done' && 'text-slate-400 line-through')}>{task.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className={cn('flex items-center gap-0.5', PRIORITY[task.priority].cls)}><Flag size={11} /> {PRIORITY[task.priority].label}</span>
        {task.due && (
          <span className={cn('flex items-center gap-0.5', overdue ? 'text-red-500' : 'text-slate-500')}><Calendar size={11} /> {dateLabel(task.due)}</span>
        )}
        {showProject && project && (
          <span className="flex items-center gap-1 text-slate-500"><span className="h-1.5 w-1.5 rounded-full" style={{ background: project.color }} />{project.name}</span>
        )}
        {note && (
          <Link to={`/notes/${note.id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-0.5 text-brand-500"><FileText size={11} /> {note.title}</Link>
        )}
      </div>
      {/* mover entre colunas no toque (drag nativo não funciona bem no mobile) */}
      <div className="mt-2 flex gap-1 md:hidden" onClick={(e) => e.stopPropagation()}>
        {idx > 0 && <button className="chip !py-1" onClick={() => onMove(COLUMNS[idx - 1].id)}>← {COLUMNS[idx - 1].label}</button>}
        {idx < 2 && <button className="chip !py-1" onClick={() => onMove(COLUMNS[idx + 1].id)}>{COLUMNS[idx + 1].label} →</button>}
      </div>
    </article>
  )
}

function TaskRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { updateTask } = useProjects()
  const project = useProjects((s) => s.projects.find((p) => p.id === task.projectId))
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <input
        type="checkbox"
        className="h-5 w-5 accent-brand-500"
        checked={task.status === 'done'}
        onChange={(e) => updateTask(task.id, { status: e.target.checked ? 'done' : 'todo' })}
        aria-label="Concluir"
      />
      <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <p className={cn('truncate text-sm', task.status === 'done' && 'text-slate-400 line-through')}>{task.title}</p>
        <p className="text-[11px] text-slate-500">
          {[project?.name, task.due && dateLabel(task.due), PRIORITY[task.priority].label].filter(Boolean).join(' · ')}
        </p>
      </button>
    </div>
  )
}

function TaskSheet({ value, onClose }: { value: Partial<Task>; onClose: () => void }) {
  const { projects, addTask, updateTask, deleteTask } = useProjects()
  const notes = useNotes((s) => s.notes)
  const [form, setForm] = useState({
    title: value.title ?? '', status: value.status ?? ('todo' as TaskStatus), priority: value.priority ?? ('medium' as Priority),
    projectId: value.projectId ?? '', noteId: value.noteId ?? '', due: value.due ?? '',
  })
  const save = () => {
    if (!form.title.trim()) return
    const data = {
      title: form.title.trim(), status: form.status, priority: form.priority,
      projectId: form.projectId || undefined, noteId: form.noteId || undefined, due: form.due || undefined,
    }
    if (value.id) updateTask(value.id, data)
    else addTask(data)
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={value.id ? 'Editar tarefa' : 'Nova tarefa'}
      footer={
        <div className="flex gap-2">
          {value.id && <button className="btn-danger" onClick={() => { deleteTask(value.id!); onClose() }} aria-label="Excluir"><Trash2 size={16} /></button>}
          <button className="btn-primary flex-1" onClick={save}>Salvar</button>
        </div>
      }>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save() }}>
        <input className="input text-base font-medium" autoFocus placeholder="O que precisa ser feito?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Segmented value={form.status} onChange={(status) => setForm({ ...form, status })} options={COLUMNS.map((c) => ({ value: c.id, label: c.label }))} />
        <div>
          <span className="label">Prioridade</span>
          <Segmented value={form.priority} onChange={(priority) => setForm({ ...form, priority })} options={(['low', 'medium', 'high'] as const).map((p) => ({ value: p, label: PRIORITY[p].label }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Projeto</label>
            <select className="input" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">Nenhum</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Prazo</label>
            <input type="date" className="input" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Nota vinculada</label>
          <select className="input" value={form.noteId} onChange={(e) => setForm({ ...form, noteId: e.target.value })}>
            <option value="">Nenhuma</option>
            {notes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
          </select>
        </div>
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}

function ProjectSheet({ value, onClose, onCreated, onDeleted }: {
  value: Partial<Project>; onClose: () => void; onCreated: (p: Project) => void; onDeleted: () => void
}) {
  const { createProject, updateProject, deleteProject } = useProjects()
  const [form, setForm] = useState({ name: value.name ?? '', description: value.description ?? '', color: value.color ?? PALETTE[0] })
  const save = () => {
    if (!form.name.trim()) return
    if (value.id) {
      if (value.name && value.name !== form.name.trim()) useNotes.getState().retargetLinks(value.name, form.name.trim())
      updateProject(value.id, { ...form, name: form.name.trim() })
    }
    else onCreated(createProject({ ...form, name: form.name.trim() }))
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={value.id ? 'Editar projeto' : 'Novo projeto'}
      footer={
        <div className="flex gap-2">
          {value.id && (
            <button className="btn-danger" onClick={() => { if (confirmAction('Excluir projeto? As tarefas serão mantidas sem projeto.')) { deleteProject(value.id!); onClose(); onDeleted() } }}>
              Excluir
            </button>
          )}
          <button className="btn-primary flex-1" onClick={save}>Salvar</button>
        </div>
      }>
      <div className="space-y-4">
        <div><label className="label">Nome</label><input className="input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <p className="-mt-2 text-[11px] text-slate-500">Dica: notas podem referenciar o projeto com [[{form.name || 'Nome do projeto'}]].</p>
        <div><label className="label">Descrição</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div><span className="label">Cor</span><ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} colors={PALETTE} /></div>
      </div>
    </Sheet>
  )
}
