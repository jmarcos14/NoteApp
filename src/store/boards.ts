import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Board, BoardItem } from '../types'
import { uid } from '../lib/utils'
import { seedBoards } from './seed'

interface BoardsState {
  boards: Board[]
  createBoard: (name: string, emoji?: string, projectId?: string) => Board
  updateBoard: (id: string, patch: Partial<Pick<Board, 'name' | 'emoji' | 'projectId' | 'viewport'>>) => void
  deleteBoard: (id: string) => void
  addItem: (boardId: string, item: Omit<BoardItem, 'id'>) => BoardItem
  updateItem: (boardId: string, itemId: string, patch: Partial<BoardItem>) => void
  deleteItem: (boardId: string, itemId: string) => void
  bringToFront: (boardId: string, itemId: string) => void
  toggleConnection: (boardId: string, from: string, to: string) => void
  reset: () => void
}

const touch = (boards: Board[], id: string, fn: (b: Board) => Partial<Board>) =>
  boards.map((b) => (b.id === id ? { ...b, ...fn(b), updatedAt: Date.now() } : b))

export const useBoards = create<BoardsState>()(
  persist(
    (set) => ({
      boards: seedBoards(),
      createBoard: (name, emoji = '🗂️', projectId) => {
        const now = Date.now()
        const board: Board = {
          id: uid(), name, emoji, projectId, items: [], connections: [],
          viewport: { x: 0, y: 0, scale: 1 }, createdAt: now, updatedAt: now,
        }
        set((s) => ({ boards: [board, ...s.boards] }))
        return board
      },
      updateBoard: (id, patch) =>
        set((s) => ({
          // viewport muda o tempo todo: não altera updatedAt
          boards: s.boards.map((b) =>
            b.id === id ? { ...b, ...patch, updatedAt: patch.viewport && Object.keys(patch).length === 1 ? b.updatedAt : Date.now() } : b,
          ),
        })),
      deleteBoard: (id) => set((s) => ({ boards: s.boards.filter((b) => b.id !== id) })),
      addItem: (boardId, item) => {
        const full = { ...item, id: uid() }
        set((s) => ({ boards: touch(s.boards, boardId, (b) => ({ items: [...b.items, full] })) }))
        return full
      },
      updateItem: (boardId, itemId, patch) =>
        set((s) => ({
          boards: touch(s.boards, boardId, (b) => ({
            items: b.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
          })),
        })),
      deleteItem: (boardId, itemId) =>
        set((s) => ({
          boards: touch(s.boards, boardId, (b) => ({
            items: b.items.filter((i) => i.id !== itemId),
            connections: b.connections.filter((c) => c.from !== itemId && c.to !== itemId),
          })),
        })),
      bringToFront: (boardId, itemId) =>
        set((s) => ({
          boards: s.boards.map((b) => {
            if (b.id !== boardId) return b
            const item = b.items.find((i) => i.id === itemId)
            if (!item || b.items[b.items.length - 1].id === itemId) return b
            return { ...b, items: [...b.items.filter((i) => i.id !== itemId), item] }
          }),
        })),
      toggleConnection: (boardId, from, to) =>
        set((s) => ({
          boards: touch(s.boards, boardId, (b) => {
            if (from === to) return {}
            const ex = b.connections.find(
              (c) => (c.from === from && c.to === to) || (c.from === to && c.to === from),
            )
            return {
              connections: ex
                ? b.connections.filter((c) => c.id !== ex.id)
                : [...b.connections, { id: uid(), from, to }],
            }
          }),
        })),
      reset: () => set({ boards: seedBoards() }),
    }),
    { name: 'noteapp-boards', version: 1 },
  ),
)
