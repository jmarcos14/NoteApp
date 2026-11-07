import type { Note, Project } from '../types'

/** Captura [[Alvo]] ou [[Alvo|apelido]] */
export const WIKILINK_RE = /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g

export const normalizeTitle = (t: string) => t.trim().toLowerCase()

/** Remove blocos e trechos de código, onde [[ ]] não deve virar link */
const stripCode = (s: string) => s.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')

/** Títulos linkados (texto original, sem duplicatas por título normalizado) */
export function extractLinkTitles(content: string): string[] {
  const out = new Map<string, string>()
  for (const m of stripCode(content).matchAll(WIKILINK_RE)) {
    const key = normalizeTitle(m[1])
    if (!out.has(key)) out.set(key, m[1].trim())
  }
  return [...out.values()]
}

/** Títulos linkados, normalizados */
export function extractLinks(content: string): string[] {
  return extractLinkTitles(content).map(normalizeTitle)
}

export function extractTags(content: string): string[] {
  const out = new Set<string>()
  for (const m of stripCode(content).matchAll(/(?:^|\s)#([\p{L}\d_-]+)/gu)) out.add(m[1].toLowerCase())
  return [...out]
}

export type LinkTarget =
  | { kind: 'note'; id: string; title: string }
  | { kind: 'project'; id: string; title: string }

/** Índice título → destino (notas têm prioridade sobre projetos) */
export function buildTitleIndex(notes: Note[], projects: Project[]) {
  const idx = new Map<string, LinkTarget>()
  for (const p of projects) idx.set(normalizeTitle(p.name), { kind: 'project', id: p.id, title: p.name })
  for (const n of notes) idx.set(normalizeTitle(n.title), { kind: 'note', id: n.id, title: n.title })
  return idx
}

/** Notas que referenciam o título informado */
export function backlinksFor(title: string, notes: Note[], excludeId?: string) {
  const key = normalizeTitle(title)
  return notes.filter((n) => n.id !== excludeId && extractLinks(n.content).includes(key))
}

/** Menções não-linkadas: o título aparece em texto puro, sem [[ ]] */
export function unlinkedMentions(title: string, notes: Note[], excludeId?: string) {
  const key = normalizeTitle(title)
  if (key.length < 3) return []
  return notes.filter((n) => {
    if (n.id === excludeId) return false
    if (extractLinks(n.content).includes(key)) return false
    return n.content.toLowerCase().includes(key)
  })
}
