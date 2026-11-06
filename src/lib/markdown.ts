import { Marked } from 'marked'
import DOMPurify from 'dompurify'
import { WIKILINK_RE, normalizeTitle, type LinkTarget } from './wikilinks'

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * Renderiza Markdown com suporte a [[wikilinks]], #tags e checklists.
 * Links internos viram <a data-wikilink="..."> e são interceptados pelo componente.
 */
export function renderMarkdown(src: string, index: Map<string, LinkTarget>): string {
  const marked = new Marked({ gfm: true, breaks: true })
  marked.use({
    extensions: [
      {
        name: 'wikilink',
        level: 'inline',
        start: (s: string) => s.indexOf('[['),
        tokenizer(s: string) {
          const re = new RegExp('^' + WIKILINK_RE.source)
          const m = re.exec(s)
          if (!m) return undefined
          return { type: 'wikilink', raw: m[0], target: m[1].trim(), alias: m[2]?.trim() }
        },
        renderer(token) {
          const t = token as unknown as { target: string; alias?: string }
          const hit = index.get(normalizeTitle(t.target))
          const cls = hit ? (hit.kind === 'project' ? 'wikilink wikilink-project' : 'wikilink') : 'wikilink wikilink-missing'
          return `<a href="#" class="${cls}" data-wikilink="${escapeHtml(t.target)}">${escapeHtml(t.alias ?? t.target)}</a>`
        },
      },
      {
        name: 'tag',
        level: 'inline',
        start: (s: string) => {
          const m = /(^|\s)#[\p{L}\d_-]/u.exec(s)
          return m ? m.index + m[1].length : undefined
        },
        tokenizer(s: string) {
          const m = /^#([\p{L}\d_-]+)/u.exec(s)
          if (!m) return undefined
          return { type: 'tag', raw: m[0], tag: m[1] }
        },
        renderer(token) {
          const t = token as unknown as { tag: string }
          return `<span class="md-tag">#${escapeHtml(t.tag)}</span>`
        },
      },
    ],
  })
  const html = marked.parse(src, { async: false }) as string
  const clean = DOMPurify.sanitize(html, { ADD_ATTR: ['data-wikilink', 'target'] })
  // checklists clicáveis no preview
  return clean.replace(/<input([^>]*?) disabled=""([^>]*?)type="checkbox"/g, '<input$1$2type="checkbox"')
}

/** Alterna o n-ésimo checkbox de lista ("- [ ]" / "- [x]") no markdown */
export function toggleNthCheckbox(src: string, n: number): string {
  let i = 0
  return src.replace(/^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\])/gm, (full, a: string, mark: string, b: string) => {
    if (i++ !== n) return full
    return a + (mark === ' ' ? 'x' : ' ') + b
  })
}
