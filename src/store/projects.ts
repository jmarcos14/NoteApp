import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project, Task, TaskStatus } from '../types'
import { uid } from '../lib/utils'
import { seedProjects } from './seed'

interface ProjectsState {
  projects: Project[]
  tasks: Task[]
  createProject: (p: Omit<Project, 'id' | 'createdAt'>) => Project
  updateProject: (id: string, patch: Partial<Project>) => void
  deleteProject: (id: string) => void
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'order'>) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  /** Move a tarefa para um status, posicionando-a antes de `beforeId` (ou no fim) */
  moveTask: (id: string, status: TaskStatus, beforeId?: string) => void
  deleteTask: (id: string) => void
  reset: () => void
}

export const useProjects = create<ProjectsState>()(
  persist(
    (set) => ({
      ...seedProjects(),
      createProject: (p) => {
        const project: Project = { ...p, id: uid(), createdAt: Date.now() }
        set((s) => ({ projects: [...s.projects, project] }))
        return project
      },
      updateProject: (id, patch) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deleteProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          tasks: s.tasks.map((t) => (t.projectId === id ? { ...t, projectId: undefined } : t)),
        })),
      addTask: (t) =>
        set((s) => {
          const max = Math.max(0, ...s.tasks.filter((x) => x.status === t.status).map((x) => x.order))
          return { tasks: [...s.tasks, { ...t, id: uid(), createdAt: Date.now(), order: max + 1 }] }
        }),
      updateTask: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      moveTask: (id, status, beforeId) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id)
          if (!task) return s
          const column = s.tasks
            .filter((t) => t.status === status && t.id !== id)
            .sort((a, b) => a.order - b.order)
          const idx = beforeId ? column.findIndex((t) => t.id === beforeId) : -1
          column.splice(idx === -1 ? column.length : idx, 0, { ...task, status })
          const orders = new Map(column.map((t, i) => [t.id, i]))
          return {
            tasks: s.tasks.map((t) =>
              orders.has(t.id) ? { ...t, status: t.id === id ? status : t.status, order: orders.get(t.id)! } : t,
            ),
          }
        }),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      reset: () => set(seedProjects()),
    }),
    { name: 'noteapp-projects', version: 1 },
  ),
)
