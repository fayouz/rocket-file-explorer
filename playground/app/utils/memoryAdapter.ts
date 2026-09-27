import type { ExplorerAdapter, ExplorerId, ExplorerItem, ExplorerTag } from '../../../app/types/explorer'

interface Node { id: number, space: number, parent: number | null, kind: 'folder' | 'file', name: string, size: number, updatedAt: string, url?: string, type?: string, tags: number[] }

/**
 * In-memory adapter of the playground: two spaces, a few folders and files, tags and a "type" filter shown as a badge.
 * Uploaded files stay in the browser (object URLs), so the quick look works without any server.
 */
export function createMemoryAdapter(): ExplorerAdapter {
  const now = () => new Date().toISOString()
  const spaces = [{ id: 1, name: 'Le port', icon: 'i-lucide-house' }, { id: 2, name: 'Les vignes', icon: 'i-lucide-house' }]
  let seq = 100
  const tags: { id: number, name: string, color: string }[] = [{ id: 1, name: 'Factures', color: 'amber' }, { id: 2, name: 'Contrats', color: 'blue' }]
  const types: Record<string, string> = { invoice: 'Facture', contract: 'Contrat', photo: 'Photo' }
  const nodes: Node[] = [
    { id: 1, space: 1, parent: null, kind: 'folder', name: 'Factures 2026', size: 0, updatedAt: now(), tags: [] },
    { id: 2, space: 1, parent: 1, kind: 'file', name: 'EDF janvier.pdf', size: 184_000, updatedAt: now(), type: 'invoice', tags: [1] },
    { id: 3, space: 1, parent: null, kind: 'file', name: 'Bail.docx', size: 52_000, updatedAt: now(), type: 'contract', tags: [2] },
    { id: 4, space: 2, parent: null, kind: 'folder', name: 'Photos', size: 0, updatedAt: now(), tags: [] },
  ]
  const tagOf = (id: number): ExplorerTag => ({ ...tags.find(t => t.id === id)!, count: nodes.filter(n => n.tags.includes(id)).length })
  const toItem = (n: Node, where?: string): ExplorerItem => ({
    id: n.id, kind: n.kind, name: n.name, size: n.size, updatedAt: n.updatedAt, parentId: n.parent, spaceId: n.space,
    previewable: n.kind === 'file' && !!n.url, where, tags: n.tags.map(tagOf), badges: n.type ? [{ label: types[n.type]!, color: n.type === 'invoice' ? 'warning' : 'neutral' }] : [],
  })
  const find = (id: ExplorerId) => nodes.find(n => n.id === Number(id))!
  const path = (n: Node | undefined): Node[] => n ? [...path(n.parent === null ? undefined : find(n.parent)), n] : []
  const taken = (space: number, parent: number | null, name: string, except = 0) => nodes.some(n => n.space === space && n.parent === parent && n.name.toLowerCase() === name.toLowerCase() && n.id !== except)
  const descendants = (id: number): number[] => nodes.filter(n => n.parent === id).flatMap(n => [n.id, ...descendants(n.id)])
  const wait = () => new Promise(r => setTimeout(r, 120))

  return {
    rootLabel: 'Documents',
    async list(loc, q) {
      await wait()
      const space = spaces.find(s => s.id === Number(loc.space)) ?? null
      if (q.q || q.tag || q.filter) {
        const found = nodes.filter(n => (!space || n.space === space.id) && (!q.q || n.name.toLowerCase().includes(q.q.toLowerCase())) && (!q.tag || n.tags.includes(Number(q.tag))) && (!q.filter || n.type === q.filter))
        return { space, spaces, items: found.map(n => toItem(n, [spaces.find(s => s.id === n.space)!.name, ...path(n).slice(0, -1).map(p => p.name)].join(' / '))) }
      }
      if (!space) return { space: null, spaces, items: spaces.map(s => ({ id: s.id, kind: 'space' as const, name: s.name, size: nodes.filter(n => n.space === s.id).length })) }
      const folder = loc.folder == null ? null : Number(loc.folder)
      return { space, spaces, path: path(folder === null ? undefined : find(folder)).map(p => ({ id: p.id, name: p.name })), items: nodes.filter(n => n.space === space.id && n.parent === folder).map(n => toItem(n)) }
    },
    async createFolder(loc, name) {
      const parent = loc.folder == null ? null : Number(loc.folder)
      if (taken(Number(loc.space), parent, name)) throw new Error('Un élément porte déjà ce nom dans ce dossier')
      nodes.push({ id: ++seq, space: Number(loc.space), parent, kind: 'folder', name, size: 0, updatedAt: now(), tags: [] })
    },
    async upload(loc, files) {
      const errors: string[] = []
      for (const f of files) {
        if (f.size > 20 * 1024 * 1024) {
          errors.push(`${f.name} : trop volumineux (20 Mo au plus)`)
          continue
        }
        const parent = loc.folder == null ? null : Number(loc.folder)
        let name = f.name
        for (let i = 2; taken(Number(loc.space), parent, name); i++) name = f.name.replace(/(\.[^.]+)?$/, ` ${i}$1`)
        nodes.push({ id: ++seq, space: Number(loc.space), parent, kind: 'file', name, size: f.size, updatedAt: now(), url: URL.createObjectURL(f), tags: [] })
      }
      return { errors }
    },
    async rename(item, name) {
      const n = find(item.id)
      if (taken(n.space, n.parent, name, n.id)) throw new Error('Un élément porte déjà ce nom dans ce dossier')
      Object.assign(n, { name, updatedAt: now() })
    },
    async move(items, target) {
      const parent = target.folder == null ? null : Number(target.folder)
      for (const it of items) {
        const n = find(it.id)
        if (parent !== null && (parent === n.id || descendants(n.id).includes(parent))) throw new Error('Impossible de déplacer un dossier dans lui-même')
        Object.assign(n, { space: Number(target.space), parent })
      }
    },
    async remove(items) {
      const ids = items.flatMap(it => [Number(it.id), ...descendants(Number(it.id))])
      for (let i = nodes.length - 1; i >= 0; i--) if (ids.includes(nodes[i]!.id)) nodes.splice(i, 1)
    },
    fileUrl(item) {
      return find(item.id).url ?? `data:text/plain,${encodeURIComponent(`Fichier de démonstration : ${item.name}`)}`
    },
    tags: {
      colors: ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink', 'gray'],
      async list() { return tags.map(t => tagOf(t.id)) },
      async create(name, color) { tags.push({ id: ++seq, name, color }) },
      async update(tag, changes) { Object.assign(tags.find(t => t.id === Number(tag.id))!, changes) },
      async remove(tag) {
        tags.splice(tags.findIndex(t => t.id === Number(tag.id)), 1)
        for (const n of nodes) n.tags = n.tags.filter(x => x !== Number(tag.id))
      },
      async assign(items, add, remove) {
        for (const it of items) {
          const n = find(it.id)
          n.tags = [...new Set([...n.tags.filter(x => !remove.map(Number).includes(x)), ...add.map(Number)])]
        }
      },
    },
    filter: { label: 'Type', placeholder: 'Tous les types', items: [Object.entries(types).map(([value, label]) => ({ label, value }))] },
    actions: items => items.length === 1 && items[0]!.kind === 'file' ? [{ id: 'type', label: 'Changer le type…', icon: 'i-lucide-receipt' }] : [],
    setType(id: ExplorerId, type: string) { find(id).type = type || undefined },
  } as ExplorerAdapter & { setType(id: ExplorerId, type: string): void }
}
