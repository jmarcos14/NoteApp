// ============================================================
// Tipos de domínio compartilhados entre os módulos
// ============================================================

export type ID = string

// ---------------- Financeiro ----------------

export type AccountType = 'checking' | 'savings' | 'cash' | 'investment'

export interface Account {
  id: ID
  name: string
  type: AccountType
  initialBalance: number
  color: string
  archived?: boolean
}

export interface CreditCard {
  id: ID
  name: string
  limit: number
  closingDay: number // dia de fechamento da fatura
  dueDay: number // dia de vencimento
  color: string
  archived?: boolean
}

export type CategoryKind = 'income' | 'expense'

export interface Category {
  id: ID
  name: string
  kind: CategoryKind
  color: string
  emoji: string
}

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id: ID
  type: TransactionType
  amount: number // sempre positivo
  date: string // YYYY-MM-DD
  description: string
  categoryId?: ID
  /** origem: conta (débito/receita/transferência) */
  accountId?: ID
  /** despesa no cartão de crédito */
  cardId?: ID
  /** destino de transferência: conta */
  toAccountId?: ID
  /** destino de transferência: pagamento de fatura */
  toCardId?: ID
  createdAt: number
}

export interface Budget {
  id: ID
  categoryId: ID
  limit: number // limite mensal
}

// ---------------- Notas ----------------

export interface Note {
  id: ID
  title: string
  content: string // Markdown
  tags: string[]
  pinned?: boolean
  createdAt: number
  updatedAt: number
}

// ---------------- Projetos / Tarefas ----------------

export type TaskStatus = 'todo' | 'doing' | 'done'
export type Priority = 'low' | 'medium' | 'high'

export interface Project {
  id: ID
  name: string
  description: string
  color: string
  createdAt: number
}

export interface Task {
  id: ID
  title: string
  status: TaskStatus
  priority: Priority
  projectId?: ID
  noteId?: ID
  due?: string // YYYY-MM-DD
  order: number
  createdAt: number
}

// ---------------- Quadros (canvas infinito) ----------------

export type BoardItemType = 'text' | 'note' | 'todo' | 'link' | 'image' | 'column'

export interface TodoEntry {
  id: ID
  text: string
  done: boolean
}

export interface BoardItem {
  id: ID
  type: BoardItemType
  x: number
  y: number
  w: number
  h?: number
  color: string
  text: string // conteúdo textual / título / url
  noteId?: ID // para type === 'note'
  todos?: TodoEntry[]
}

export interface BoardConnection {
  id: ID
  from: ID
  to: ID
}

export interface Board {
  id: ID
  name: string
  emoji: string
  projectId?: ID
  items: BoardItem[]
  connections: BoardConnection[]
  viewport: { x: number; y: number; scale: number }
  createdAt: number
  updatedAt: number
}
