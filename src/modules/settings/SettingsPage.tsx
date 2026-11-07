import { useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Eye, Monitor, Moon, RotateCcw, Sun, Upload } from 'lucide-react'
import { PageHeader, SectionTitle, Segmented, confirmAction } from '../../components/ui'
import { useSettings, type Theme } from '../../store/settings'
import { useFinance } from '../../store/finance'
import { useNotes } from '../../store/notes'
import { useProjects } from '../../store/projects'
import { useBoards } from '../../store/boards'
import { isoDate } from '../../lib/utils'

const STORES = { finance: useFinance, notes: useNotes, projects: useProjects, boards: useBoards } as const

/** Apenas os dados (sem funções) de cada store */
const dataOf = (state: object) => Object.fromEntries(Object.entries(state).filter(([, v]) => typeof v !== 'function'))

export default function SettingsPage() {
  const navigate = useNavigate()
  const { theme, setTheme, hideValues, toggleHideValues } = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)

  const exportData = () => {
    const payload = {
      app: 'noteapp',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: Object.fromEntries(Object.entries(STORES).map(([k, s]) => [k, dataOf(s.getState())])),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `noteapp-backup-${isoDate()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importData = async (file: File) => {
    try {
      const json = JSON.parse(await file.text())
      if (json.app !== 'noteapp' || !json.data) throw new Error('Arquivo inválido')
      if (!confirmAction('Substituir todos os dados atuais pelo backup?')) return
      for (const [k, store] of Object.entries(STORES)) {
        if (json.data[k]) (store as unknown as { setState: (s: object) => void }).setState(json.data[k])
      }
      alert('Backup restaurado!')
    } catch (e) {
      alert('Não foi possível importar: ' + (e as Error).message)
    }
  }

  const resetAll = () => {
    if (!confirmAction('Restaurar os dados de exemplo? Tudo que você criou será perdido.')) return
    Object.values(STORES).forEach((s) => s.getState().reset())
  }

  const clearAll = () => {
    if (!confirmAction('Apagar TODOS os dados e começar do zero?')) return
    useFinance.setState({ accounts: [], cards: [], transactions: [], budgets: [] })
    useNotes.setState({ notes: [] })
    useProjects.setState({ projects: [], tasks: [] })
    useBoards.setState({ boards: [] })
  }

  return (
    <>
      <PageHeader title="Configurações" actions={<button className="icon-btn" onClick={() => navigate(-1)} aria-label="Voltar"><ArrowLeft size={18} /></button>} />
      <div className="mx-auto max-w-2xl px-4 py-2">
        <SectionTitle>Aparência</SectionTitle>
        <div className="card p-4">
          <p className="mb-2 text-sm font-medium">Tema</p>
          <Segmented<Theme>
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: <span className="flex items-center justify-center gap-1.5"><Sun size={14} /> Claro</span> },
              { value: 'dark', label: <span className="flex items-center justify-center gap-1.5"><Moon size={14} /> Escuro</span> },
              { value: 'system', label: <span className="flex items-center justify-center gap-1.5"><Monitor size={14} /> Sistema</span> },
            ]}
          />
        </div>

        <SectionTitle>Privacidade</SectionTitle>
        <Row icon={<Eye size={18} />} title="Ocultar valores financeiros" text="Esconde saldos e valores (útil em público)">
          <Toggle on={hideValues} onClick={toggleHideValues} />
        </Row>

        <SectionTitle>Dados</SectionTitle>
        <div className="card divide-y divide-slate-100 dark:divide-white/5">
          <Row icon={<Download size={18} />} title="Exportar backup" text="Baixa um arquivo JSON com todos os dados" onClick={exportData} flat />
          <Row icon={<Upload size={18} />} title="Importar backup" text="Restaura a partir de um arquivo JSON" onClick={() => fileRef.current?.click()} flat />
          <Row icon={<RotateCcw size={18} />} title="Restaurar dados de exemplo" onClick={resetAll} flat />
          <button className="w-full p-4 text-left text-sm font-medium text-red-500" onClick={clearAll}>Apagar todos os dados</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />

        <p className="mt-8 text-center text-xs text-slate-400">
          NoteApp · dados salvos localmente no seu dispositivo
        </p>
      </div>
    </>
  )
}

function Row({ icon, title, text, children, onClick, flat }: {
  icon: ReactNode; title: string; text?: string; children?: ReactNode; onClick?: () => void; flat?: boolean
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp onClick={onClick} className={`flex w-full items-center gap-3 p-4 text-left ${flat ? '' : 'card'} ${onClick ? 'hover:bg-slate-50 dark:hover:bg-white/[.03]' : ''}`}>
      <span className="text-slate-500">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {text && <span className="block text-xs text-slate-500">{text}</span>}
      </span>
      {children}
    </Comp>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`relative h-7 w-12 rounded-full transition ${on ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/15'}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  )
}
