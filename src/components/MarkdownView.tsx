import { useCallback, useMemo, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { renderMarkdown, toggleNthCheckbox } from '../lib/markdown'
import { buildTitleIndex, normalizeTitle } from '../lib/wikilinks'
import { useNotes } from '../store/notes'
import { useProjects } from '../store/projects'
import { cn } from '../lib/utils'

export function useTitleIndex() {
  const notes = useNotes((s) => s.notes)
  const projects = useProjects((s) => s.projects)
  return useMemo(() => buildTitleIndex(notes, projects), [notes, projects])
}

/** Abre o destino de um [[link]]; cria a nota se ela ainda não existir */
export function useOpenWikilink() {
  const navigate = useNavigate()
  const index = useTitleIndex()
  const createNote = useNotes((s) => s.createNote)
  return useCallback(
    (title: string) => {
      const hit = index.get(normalizeTitle(title))
      if (hit?.kind === 'note') navigate(`/notes/${hit.id}`)
      else if (hit?.kind === 'project') navigate(`/projects/${hit.id}`)
      else {
        const n = createNote(title.trim(), `# ${title.trim()}\n\n`)
        navigate(`/notes/${n.id}`)
      }
    },
    [index, navigate, createNote],
  )
}

export default function MarkdownView({ content, onChange, className }: {
  content: string
  /** se informado, checkboxes ficam clicáveis */
  onChange?: (next: string) => void
  className?: string
}) {
  const index = useTitleIndex()
  const open = useOpenWikilink()
  const html = useMemo(() => renderMarkdown(content, index), [content, index])

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement
    const link = el.closest<HTMLAnchorElement>('a')
    if (link?.dataset.wikilink) {
      e.preventDefault()
      e.stopPropagation()
      open(link.dataset.wikilink)
      return
    }
    if (link && !link.target) {
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
    }
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      if (!onChange) {
        e.preventDefault()
        return
      }
      const boxes = [...e.currentTarget.querySelectorAll('input[type="checkbox"]')]
      onChange(toggleNthCheckbox(content, boxes.indexOf(el)))
    }
  }

  return <div className={cn('prose-note', className)} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
}
