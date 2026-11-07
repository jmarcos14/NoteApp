import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNav, SideNav } from './components/BottomNav'
import { applyTheme, useSettings } from './store/settings'
import { cn } from './lib/utils'

const FinanceLayout = lazy(() => import('./modules/finance/FinanceLayout'))
const FinanceDashboard = lazy(() => import('./modules/finance/Dashboard'))
const TransactionsPage = lazy(() => import('./modules/finance/Transactions'))
const AccountsPage = lazy(() => import('./modules/finance/Accounts'))
const BudgetsPage = lazy(() => import('./modules/finance/Budgets'))
const ReportsPage = lazy(() => import('./modules/finance/Reports'))
const NotesList = lazy(() => import('./modules/notes/NotesList'))
const NoteEditor = lazy(() => import('./modules/notes/NoteEditor'))
const BoardsList = lazy(() => import('./modules/boards/BoardsList'))
const BoardCanvas = lazy(() => import('./modules/boards/BoardCanvas'))
const ProjectsPage = lazy(() => import('./modules/projects/ProjectsPage'))
const GraphView = lazy(() => import('./modules/graph/GraphView'))
const SettingsPage = lazy(() => import('./modules/settings/SettingsPage'))

export default function App() {
  const theme = useSettings((s) => s.theme)
  const { pathname } = useLocation()

  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const fn = () => applyTheme('system')
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [theme])

  // Telas imersivas (canvas, grafo, editor) ocupam toda a altura
  const fullscreen = /^\/(boards\/[^/]+|graph)$/.test(pathname)

  return (
    <div className="min-h-full">
      <SideNav />
      <main className={cn('md:pl-20', fullscreen ? 'h-[calc(100dvh-4rem-env(safe-area-inset-bottom))] md:h-dvh' : 'pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8')}>
        <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/finance" replace />} />
          <Route path="/finance" element={<FinanceLayout />}>
            <Route index element={<FinanceDashboard />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="budgets" element={<BudgetsPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>
          <Route path="/notes" element={<NotesList />} />
          <Route path="/notes/:id" element={<NoteEditor />} />
          <Route path="/boards" element={<BoardsList />} />
          <Route path="/boards/:id" element={<BoardCanvas />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectsPage />} />
          <Route path="/graph" element={<GraphView />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/finance" replace />} />
        </Routes>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  )
}
