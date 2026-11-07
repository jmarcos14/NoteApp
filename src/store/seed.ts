// Dados de exemplo para o primeiro uso (relativos à data atual)
import type { Account, Board, Budget, Category, CreditCard, Note, Project, Task, Transaction } from '../types'
import { isoDate } from '../lib/utils'

const day = (offsetDays: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return isoDate(d)
}
/** data no mês `monthsAgo` atrás, no dia `d` (limitado ao fim do mês / hoje) */
const inMonth = (monthsAgo: number, d: number) => {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0).getDate()
  let date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, Math.min(d, last))
  if (date > now) date = now
  return isoDate(date)
}

export function seedFinance() {
  const accounts: Account[] = [
    { id: 'acc-main', name: 'Banco Principal', type: 'checking', initialBalance: 3200, color: '#6366f1' },
    { id: 'acc-save', name: 'Reserva de Emergência', type: 'savings', initialBalance: 8000, color: '#22c55e' },
    { id: 'acc-cash', name: 'Carteira', type: 'cash', initialBalance: 900, color: '#eab308' },
    { id: 'acc-inv', name: 'Corretora', type: 'investment', initialBalance: 12000, color: '#06b6d4' },
  ]
  const cards: CreditCard[] = [
    { id: 'card-1', name: 'Cartão Roxo', limit: 6000, closingDay: 3, dueDay: 10, color: '#8b5cf6' },
    { id: 'card-2', name: 'Cartão Black', limit: 15000, closingDay: 20, dueDay: 28, color: '#1e293b' },
  ]
  const categories: Category[] = [
    { id: 'cat-salary', name: 'Salário', kind: 'income', color: '#22c55e', emoji: '💼' },
    { id: 'cat-freela', name: 'Freelance', kind: 'income', color: '#14b8a6', emoji: '🧑‍💻' },
    { id: 'cat-yield', name: 'Rendimentos', kind: 'income', color: '#06b6d4', emoji: '📈' },
    { id: 'cat-home', name: 'Moradia', kind: 'expense', color: '#6366f1', emoji: '🏠' },
    { id: 'cat-food', name: 'Alimentação', kind: 'expense', color: '#f97316', emoji: '🍽️' },
    { id: 'cat-market', name: 'Mercado', kind: 'expense', color: '#eab308', emoji: '🛒' },
    { id: 'cat-transport', name: 'Transporte', kind: 'expense', color: '#3b82f6', emoji: '🚗' },
    { id: 'cat-health', name: 'Saúde', kind: 'expense', color: '#ef4444', emoji: '💊' },
    { id: 'cat-fun', name: 'Lazer', kind: 'expense', color: '#ec4899', emoji: '🎬' },
    { id: 'cat-subs', name: 'Assinaturas', kind: 'expense', color: '#8b5cf6', emoji: '📺' },
    { id: 'cat-edu', name: 'Educação', kind: 'expense', color: '#64748b', emoji: '📚' },
  ]
  const budgets: Budget[] = [
    { id: 'b-food', categoryId: 'cat-food', limit: 800 },
    { id: 'b-market', categoryId: 'cat-market', limit: 1200 },
    { id: 'b-transport', categoryId: 'cat-transport', limit: 500 },
    { id: 'b-fun', categoryId: 'cat-fun', limit: 400 },
    { id: 'b-subs', categoryId: 'cat-subs', limit: 150 },
  ]

  const transactions: Transaction[] = []
  let n = 0
  const tx = (t: Omit<Transaction, 'id' | 'createdAt'>) =>
    transactions.push({ ...t, id: `seed-tx-${n++}`, createdAt: Date.now() - n })

  // 6 meses de histórico com leve variação
  for (let m = 5; m >= 0; m--) {
    const v = (base: number, spread = 0.25) => Math.round(base * (1 - spread / 2 + ((m * 37 + base) % 100) / 100 * spread))
    tx({ type: 'income', amount: 7500, date: inMonth(m, 5), description: 'Salário', categoryId: 'cat-salary', accountId: 'acc-main' })
    if (m % 2 === 0) tx({ type: 'income', amount: v(1800, 0.5), date: inMonth(m, 18), description: 'Projeto freelance', categoryId: 'cat-freela', accountId: 'acc-main' })
    tx({ type: 'income', amount: v(110), date: inMonth(m, 28), description: 'Rendimento CDB', categoryId: 'cat-yield', accountId: 'acc-inv' })
    tx({ type: 'expense', amount: 2100, date: inMonth(m, 7), description: 'Aluguel', categoryId: 'cat-home', accountId: 'acc-main' })
    tx({ type: 'expense', amount: v(260), date: inMonth(m, 12), description: 'Energia + Internet', categoryId: 'cat-home', accountId: 'acc-main' })
    tx({ type: 'expense', amount: v(540), date: inMonth(m, 9), description: 'Supermercado', categoryId: 'cat-market', cardId: 'card-1' })
    tx({ type: 'expense', amount: v(380), date: inMonth(m, 22), description: 'Supermercado', categoryId: 'cat-market', cardId: 'card-2' })
    tx({ type: 'expense', amount: v(320), date: inMonth(m, 14), description: 'Restaurantes', categoryId: 'cat-food', cardId: 'card-2' })
    tx({ type: 'expense', amount: v(95), date: inMonth(m, 3), description: 'Padaria', categoryId: 'cat-food', accountId: 'acc-cash' })
    tx({ type: 'expense', amount: v(280), date: inMonth(m, 16), description: 'Combustível', categoryId: 'cat-transport', cardId: 'card-1' })
    tx({ type: 'expense', amount: 89.9, date: inMonth(m, 10), description: 'Streaming + música', categoryId: 'cat-subs', cardId: 'card-2' })
    if (m % 3 !== 1) tx({ type: 'expense', amount: v(220), date: inMonth(m, 20), description: 'Cinema e passeios', categoryId: 'cat-fun', cardId: 'card-1' })
    if (m % 2 === 1) tx({ type: 'expense', amount: v(180), date: inMonth(m, 24), description: 'Farmácia', categoryId: 'cat-health', accountId: 'acc-main' })
    if (m === 2) tx({ type: 'expense', amount: 497, date: inMonth(m, 11), description: 'Curso online', categoryId: 'cat-edu', cardId: 'card-2' })
    // pagamentos de fatura e aportes
    if (m > 0) {
      tx({ type: 'transfer', amount: v(1100), date: inMonth(m, 10), description: 'Pagamento fatura Roxo', accountId: 'acc-main', toCardId: 'card-1' })
      tx({ type: 'transfer', amount: v(800), date: inMonth(m, 27), description: 'Pagamento fatura Black', accountId: 'acc-main', toCardId: 'card-2' })
    }
    tx({ type: 'transfer', amount: 1000, date: inMonth(m, 6), description: 'Aporte mensal', accountId: 'acc-main', toAccountId: 'acc-inv' })
  }
  tx({ type: 'expense', amount: 42.5, date: day(0), description: 'Almoço', categoryId: 'cat-food', accountId: 'acc-main' })

  return { accounts, cards, categories, budgets, transactions }
}

export function seedNotes(): Note[] {
  const now = Date.now()
  const h = 3600_000
  const mk = (id: string, title: string, content: string, ago: number, pinned = false): Note => ({
    id, title, content, pinned, tags: [...content.matchAll(/(?:^|\s)#([\p{L}\d_-]+)/gu)].map((m) => m[1].toLowerCase()),
    createdAt: now - ago * h - 48 * h, updatedAt: now - ago * h,
  })
  return [
    mk('note-welcome', 'Bem-vindo', `# Bem-vindo ao NoteApp 👋

Este é seu segundo cérebro **financeiro e criativo**.

- Use \`[[Título da nota]]\` para criar **links bidirecionais** — ex.: [[Ideias de projetos]].
- Links para notas que ainda não existem aparecem tracejados: clique para criá-las → [[Leituras 2026]]
- Também é possível linkar **projetos** pelo nome: [[Mudança de apartamento]]
- Marque tópicos com #tags, como #guia.

Veja como tudo se conecta na aba **Grafo** 🕸️`, 1, true),
    mk('note-ideas', 'Ideias de projetos', `## Ideias

- [ ] App de controle de hábitos
- [x] Organizar a [[Reserva de emergência]]
- [ ] Planejar a [[Viagem para o Chile]]

Relacionado: [[Bem-vindo]] #ideias`, 5),
    mk('note-reserve', 'Reserva de emergência', `# Reserva de emergência

Meta: **6 meses** de custo de vida.

| Item | Valor |
|---|---|
| Custo mensal | R$ 4.500 |
| Meta | R$ 27.000 |

Acompanhar no módulo financeiro. Ver também [[Metas financeiras 2026]]. #financas`, 12),
    mk('note-goals', 'Metas financeiras 2026', `# Metas 2026

1. Completar a [[Reserva de emergência]]
2. Investir 15% da renda
3. Juntar para a [[Viagem para o Chile]]

> "Não economize o que sobra depois de gastar; gaste o que sobra depois de economizar."

#financas #metas`, 30),
    mk('note-chile', 'Viagem para o Chile', `# Viagem para o Chile 🇨🇱

- Período: julho
- Orçamento estimado: R$ 9.000
- Quadro de referências no módulo **Quadros**

Projeto: [[Mudança de apartamento]] pode atrasar a viagem — revisar [[Metas financeiras 2026]]. #viagem`, 20),
    mk('note-move', 'Checklist da mudança', `# Checklist

- [ ] Orçar transportadora
- [ ] Trocar endereço no banco
- [ ] Comprar cortinas

Projeto: [[Mudança de apartamento]] #casa`, 8),
  ]
}

export function seedProjects(): { projects: Project[]; tasks: Task[] } {
  const now = Date.now()
  const projects: Project[] = [
    { id: 'proj-move', name: 'Mudança de apartamento', description: 'Tudo sobre a mudança de março.', color: '#f97316', createdAt: now },
    { id: 'proj-site', name: 'Site pessoal', description: 'Portfólio e blog.', color: '#6366f1', createdAt: now },
  ]
  let o = 0
  const t = (title: string, status: Task['status'], priority: Task['priority'], projectId?: string, extra: Partial<Task> = {}): Task => ({
    id: `seed-task-${o}`, title, status, priority, projectId, order: o++, createdAt: now - o * 1000, ...extra,
  })
  const tasks: Task[] = [
    t('Orçar transportadora', 'todo', 'high', 'proj-move', { due: day(5), noteId: 'note-move' }),
    t('Separar caixas', 'todo', 'medium', 'proj-move'),
    t('Vistoria do novo apê', 'doing', 'high', 'proj-move', { due: day(2) }),
    t('Assinar contrato', 'done', 'high', 'proj-move'),
    t('Escolher tema do site', 'doing', 'low', 'proj-site'),
    t('Escrever primeiro post', 'todo', 'medium', 'proj-site'),
    t('Registrar domínio', 'done', 'medium', 'proj-site'),
    t('Revisar orçamento mensal', 'todo', 'medium', undefined, { due: day(1), noteId: 'note-goals' }),
  ]
  return { projects, tasks }
}

export function seedBoards(): Board[] {
  const now = Date.now()
  return [
    {
      id: 'board-chile',
      name: 'Viagem para o Chile',
      emoji: '🏔️',
      createdAt: now,
      updatedAt: now,
      viewport: { x: 16, y: 80, scale: 0.8 },
      items: [
        { id: 'bi-title', type: 'text', x: 20, y: -10, w: 340, color: 'transparent', text: '# Chile — Julho 🇨🇱' },
        { id: 'bi-col', type: 'column', x: 20, y: 80, w: 260, h: 340, color: '#ede9fe', text: 'Roteiro' },
        { id: 'bi-1', type: 'text', x: 40, y: 130, w: 220, color: '#ffffff', text: '**Santiago** — 3 dias\nCerro San Cristóbal, Bellavista' },
        { id: 'bi-2', type: 'text', x: 40, y: 240, w: 220, color: '#ffffff', text: '**Atacama** — 4 dias\nGêiseres, Vale da Lua' },
        { id: 'bi-note', type: 'note', x: 330, y: 80, w: 240, color: '#dbeafe', text: '', noteId: 'note-chile' },
        {
          id: 'bi-todo', type: 'todo', x: 330, y: 360, w: 240, color: '#dcfce7', text: 'Antes de ir',
          todos: [
            { id: 't1', text: 'Passaporte em dia', done: true },
            { id: 't2', text: 'Comprar passagens', done: false },
            { id: 't3', text: 'Seguro viagem', done: false },
          ],
        },
        { id: 'bi-link', type: 'link', x: 620, y: 80, w: 240, color: '#fef3c7', text: 'https://pt.wikipedia.org/wiki/Deserto_do_Atacama' },
        { id: 'bi-sticky', type: 'text', x: 620, y: 200, w: 200, color: '#fce7f3', text: '💡 Levar casaco: noites a -5°C no deserto!' },
      ],
      connections: [
        { id: 'c1', from: 'bi-col', to: 'bi-note' },
        { id: 'c2', from: 'bi-note', to: 'bi-link' },
      ],
    },
    {
      id: 'board-move',
      name: 'Moodboard do apê',
      emoji: '🛋️',
      projectId: 'proj-move',
      createdAt: now - 86400_000,
      updatedAt: now - 86400_000,
      viewport: { x: 16, y: 80, scale: 1 },
      items: [
        { id: 'bm-1', type: 'text', x: 0, y: 0, w: 240, color: '#fef3c7', text: '**Sala**: tons terrosos, madeira clara' },
        { id: 'bm-2', type: 'note', x: 280, y: 0, w: 240, color: '#dcfce7', text: '', noteId: 'note-move' },
      ],
      connections: [{ id: 'cm1', from: 'bm-1', to: 'bm-2' }],
    },
  ]
}
