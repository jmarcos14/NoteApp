import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Note } from '../types'
import { uid } from '../lib/utils'
import { WIKILINK_RE, extractTags, normalizeTitle } from '../lib/wikilinks'
import { seedNotes } from './seed'

interface NotesState {
  notes: Note[]
  createNote: (title?: string, content?: string) => Note
  updateNote: (id: string, patch: Partial<Pick<Note, 'content' | 'pinned'>>) => void
  /** Renomeia e atualiza todos os [[links]] que apontavam para o título antigo */
  renameNote: (id: string, title: string) => void
  deleteNote: (id: string) => void
  /** Reescreve [[antigo]] → [[novo]] em todas as notas (usado ao renomear projetos) */
  retargetLinks: (oldTitle: string, newTitle: string) => void
  reset: () => void
}

export function uniqueTitle(base: string, notes: Note[]) {
  const taken = new Set(notes.map((n) => normalizeTitle(n.title)))
  if (!taken.has(normalizeTitle(base))) return base
  let i = 2
  while (taken.has(normalizeTitle(`${base} ${i}`))) i++
  return `${base} ${i}`
}

export const useNotes = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: seedNotes(),
      createNote: (title = 'Sem título', content = '') => {
        const now = Date.now()
        const note: Note = {
          id: uid(),
          title: uniqueTitle(title, get().notes),
          content,
          tags: extractTags(content),
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({ notes: [note, ...s.notes] }))
        return note
      },
      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  ...patch,
                  tags: patch.content !== undefined ? extractTags(patch.content) : n.tags,
                  updatedAt: patch.content !== undefined ? Date.now() : n.updatedAt,
                }
              : n,
          ),
        })),
      renameNote: (id, title) =>
        set((s) => {
          const note = s.notes.find((n) => n.id === id)
          const clean = title.trim()
          if (!note || !clean || clean === note.title) return s
          const oldKey = normalizeTitle(note.title)
          return {
            notes: s.notes.map((n) => {
              const content = n.content.replace(WIKILINK_RE, (full, target: string, alias?: string) =>
                normalizeTitle(target) === oldKey ? `[[${clean}${alias ? `|${alias}` : ''}]]` : full,
              )
              if (n.id === id) return { ...n, title: clean, content, updatedAt: Date.now() }
              return content === n.content ? n : { ...n, content }
            }),
          }
        }),
      retargetLinks: (oldTitle, newTitle) =>
        set((s) => {
          const oldKey = normalizeTitle(oldTitle)
          return {
            notes: s.notes.map((n) => {
              const content = n.content.replace(WIKILINK_RE, (full, target: string, alias?: string) =>
                normalizeTitle(target) === oldKey ? `[[${newTitle}${alias ? `|${alias}` : ''}]]` : full,
              )
              return content === n.content ? n : { ...n, content }
            }),
          }
        }),
      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      reset: () => set({ notes: seedNotes() }),
    }),
    { name: 'noteapp-notes', version: 1 },
  ),
)
