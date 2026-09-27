<!--
  Finder-like file explorer (icons or list, breadcrumb, back/forward, search, tags, extra filter, drag and drop, context
  menu, keyboard, quick look). Knows no server: every operation goes through the `adapter` prop (see types/explorer.ts).
  `space`: locks the explorer on one space (no sidebar); otherwise a sidebar lists the spaces.
  Emits `action` (id, items) for the adapter's application actions of the context menu. Exposes `refresh()` and `pickFiles()`.
  `v-model:location` (optional): the location follows the page (e.g. ?folder= in the URL, so links and the back button work).
-->
<script setup lang="ts">
import type { ExplorerAdapter, ExplorerId, ExplorerItem, ExplorerListing, ExplorerLocation, ExplorerTag } from '../types/explorer'

const props = withDefaults(defineProps<{ adapter: ExplorerAdapter, space?: ExplorerId, height?: string, readonly?: boolean, location?: ExplorerLocation }>(), { space: undefined, height: '32rem', readonly: false, location: undefined })
const emit = defineEmits<{ 'action': [id: string, items: ExplorerItem[]], 'update:location': [location: ExplorerLocation] }>()
const locked = computed(() => props.space !== undefined)
const rootLabel = computed(() => props.adapter.rootLabel ?? 'Documents')

// --- Location and history (back / forward) ---
const loc = ref<ExplorerLocation>(props.location ? { ...props.location } : locked.value ? { space: props.space } : {})
const history = ref<ExplorerLocation[]>([{ ...loc.value }])
const hpos = ref(0)
const canBack = computed(() => hpos.value > 0)
const canForward = computed(() => hpos.value < history.value.length - 1)
function resetFilters() {
  query.value = ''
  debounced.value = ''
  tagFilter.value = null
  filter.value = ALL
}
function go(to: ExplorerLocation) {
  if (locked.value && to.space !== props.space) return
  resetFilters()
  loc.value = { ...to }
  history.value = [...history.value.slice(0, hpos.value + 1), { ...to }]
  hpos.value = history.value.length - 1
}
const sameLoc = (a?: ExplorerLocation, b?: ExplorerLocation) => (a?.space ?? null) === (b?.space ?? null) && (a?.folder ?? null) === (b?.folder ?? null)
// Location driven by the page (v-model:location): report our moves, follow its changes (browser back button…)
watch(loc, (v) => { if (props.location !== undefined && !sameLoc(v, props.location)) emit('update:location', { ...v }) }, { deep: true })
watch(() => props.location, (v) => {
  if (v === undefined || sameLoc(v, loc.value)) return
  resetFilters()
  loc.value = { ...v }
}, { deep: true })
function back() {
  if (!canBack.value) return
  hpos.value--
  resetFilters()
  loc.value = { ...history.value[hpos.value]! }
}
function forward() {
  if (!canForward.value) return
  hpos.value++
  resetFilters()
  loc.value = { ...history.value[hpos.value]! }
}

// --- Search and filters ---
const ALL = '__all'
const query = ref('')
const debounced = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(query, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => { debounced.value = v.trim() }, 250)
})
onBeforeUnmount(() => clearTimeout(timer))
const tagFilter = ref<ExplorerId | null>(null)
const filter = ref(ALL)
const filterItems = computed(() => props.adapter.filter ? [[{ label: props.adapter.filter.placeholder ?? 'Tous', value: ALL }], ...props.adapter.filter.items] : [])
const searching = computed(() => !!debounced.value || tagFilter.value !== null || filter.value !== ALL)

// --- Loading ---
const listing = ref<ExplorerListing | null>(null)
const loading = ref(false)
const error = ref('')
const notes = ref<string[]>([])
const msg = (e: unknown) => props.adapter.errorMessage?.(e) ?? (e instanceof Error ? e.message : 'Échec, réessaie.')
let seq = 0
async function refresh() {
  const n = ++seq
  loading.value = true
  try {
    const r = await props.adapter.list(loc.value, { q: debounced.value || undefined, tag: tagFilter.value, filter: filter.value === ALL ? null : filter.value })
    if (n === seq) {
      listing.value = r
      error.value = ''
    }
  }
  catch (e) {
    if (n === seq) error.value = msg(e)
  }
  finally {
    if (n === seq) loading.value = false
  }
}
watch([loc, debounced, tagFilter, filter], refresh, { deep: true })
watch(loc, () => {
  selected.value = []
  renaming.value = ''
  creating.value = null
  notes.value = []
}, { deep: true })
onMounted(refresh)

const tags = ref<ExplorerTag[]>([])
async function refreshTags() {
  if (!props.adapter.tags) return
  try { tags.value = await props.adapter.tags.list() }
  catch (e) { error.value = msg(e) }
}
onMounted(refreshTags)
const tagColors = computed(() => props.adapter.tags?.colors ?? [])
// Full class names (Tailwind cannot guess assembled ones)
const DOT: Record<string, string> = { red: 'bg-red-500', orange: 'bg-orange-500', amber: 'bg-amber-500', green: 'bg-green-500', teal: 'bg-teal-500', blue: 'bg-blue-500', violet: 'bg-violet-500', pink: 'bg-pink-500', gray: 'bg-gray-400' }
const BADGE: Record<string, string> = { neutral: 'bg-elevated text-muted', success: 'bg-success/15 text-success', warning: 'bg-warning/15 text-warning', error: 'bg-error/15 text-error', info: 'bg-info/15 text-info' }
function toggleTagFilter(id: ExplorerId) { tagFilter.value = tagFilter.value === id ? null : id }
const canWrite = computed(() => !props.readonly && loc.value.space !== undefined && !searching.value)

// --- Breadcrumb ---
interface Crumb { label: string, loc: ExplorerLocation, search?: boolean }
const crumbs = computed<Crumb[]>(() => {
  const out: Crumb[] = []
  if (!locked.value) out.push({ label: rootLabel.value, loc: {} })
  if (loc.value.space !== undefined) {
    const name = listing.value?.space?.name ?? listing.value?.spaces?.find(s => s.id === loc.value.space)?.name ?? '…'
    out.push({ label: name, loc: { space: loc.value.space } })
    for (const p of listing.value?.path ?? []) out.push({ label: p.name, loc: { space: loc.value.space, folder: p.id } })
  }
  if (searching.value) {
    const tagName = tags.value.find(t => t.id === tagFilter.value)?.name
    const filterName = filterItems.value.flat().find(i => i.value === filter.value && filter.value !== ALL)?.label
    out.push({ label: [filterName && `${props.adapter.filter?.label ?? 'Filtre'} : ${filterName}`, tagName && `Étiquette : ${tagName}`, debounced.value && `Recherche : ${debounced.value}`].filter(Boolean).join(' + '), loc: loc.value, search: true })
  }
  return out
})
const here = computed(() => crumbs.value.at(-1)?.label ?? rootLabel.value)

// --- Items, sort ---
const view = ref<'icons' | 'list'>('icons')
type SortKey = 'name' | 'date' | 'size' | 'kind'
const sort = reactive<{ key: SortKey, dir: 1 | -1 }>({ key: 'name', dir: 1 })
const cols: { k: SortKey, label: string, cls: string }[] = [{ k: 'name', label: 'Nom', cls: '' }, { k: 'date', label: 'Modifié', cls: '' }, { k: 'size', label: 'Taille', cls: 'text-right' }, { k: 'kind', label: 'Type', cls: '' }]
function sortBy(k: SortKey) {
  if (sort.key === k) sort.dir = sort.dir === 1 ? -1 : 1
  else Object.assign(sort, { key: k, dir: 1 })
}
const extOf = (it: ExplorerItem) => it.kind === 'file' ? (it.ext ?? it.name.split('.').pop() ?? '').toLowerCase() : ''
const items = computed<ExplorerItem[]>(() => {
  const list = [...(listing.value?.items ?? [])]
  const cmp = (a: ExplorerItem, b: ExplorerItem) => {
    if (sort.key === 'date') return (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '')
    if (sort.key === 'size') return (a.size ?? 0) - (b.size ?? 0)
    if (sort.key === 'kind') return kindOf(a).localeCompare(kindOf(b), 'fr')
    return a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' })
  }
  // Folders first (like the Finder), then the chosen order
  return list.sort((a, b) => (a.kind === 'file' ? 1 : 0) - (b.kind === 'file' ? 1 : 0) || cmp(a, b) * sort.dir)
})
const key = (it: ExplorerItem) => `${it.kind}:${it.id}`
const EXT_ICON: Record<string, [string, string]> = {
  pdf: ['i-lucide-file-text', 'text-red-500'], png: ['i-lucide-file-image', 'text-emerald-500'], jpg: ['i-lucide-file-image', 'text-emerald-500'], jpeg: ['i-lucide-file-image', 'text-emerald-500'],
  webp: ['i-lucide-file-image', 'text-emerald-500'], gif: ['i-lucide-file-image', 'text-emerald-500'], svg: ['i-lucide-file-image', 'text-emerald-500'],
  xlsx: ['i-lucide-file-spreadsheet', 'text-green-600'], xls: ['i-lucide-file-spreadsheet', 'text-green-600'], csv: ['i-lucide-file-spreadsheet', 'text-green-600'], ods: ['i-lucide-file-spreadsheet', 'text-green-600'],
  docx: ['i-lucide-file-text', 'text-blue-500'], doc: ['i-lucide-file-text', 'text-blue-500'], odt: ['i-lucide-file-text', 'text-blue-500'], txt: ['i-lucide-file-text', 'text-muted'], md: ['i-lucide-file-text', 'text-muted'],
  mp3: ['i-lucide-file-audio', 'text-violet-500'], wav: ['i-lucide-file-audio', 'text-violet-500'], mp4: ['i-lucide-file-video', 'text-pink-500'], mov: ['i-lucide-file-video', 'text-pink-500'],
  zip: ['i-lucide-file-archive', 'text-amber-600'],
}
const iconOf = (it: ExplorerItem) => it.kind === 'space' ? (it.name && listing.value?.spaces?.find(s => s.id === it.id)?.icon) || 'i-lucide-folder-closed' : it.kind === 'folder' ? 'i-lucide-folder' : (EXT_ICON[extOf(it)]?.[0] ?? 'i-lucide-file')
const colorOf = (it: ExplorerItem) => it.kind !== 'file' ? 'text-sky-500' : (EXT_ICON[extOf(it)]?.[1] ?? 'text-muted')
const KIND: Record<string, string> = { pdf: 'Document PDF', png: 'Image PNG', jpg: 'Image JPEG', jpeg: 'Image JPEG', webp: 'Image WebP', gif: 'Image GIF', svg: 'Image SVG', csv: 'Tableur CSV', xlsx: 'Feuille Excel', xls: 'Feuille Excel', docx: 'Document Word', doc: 'Document Word', txt: 'Texte', md: 'Texte', zip: 'Archive', mp3: 'Audio', mp4: 'Vidéo' }
const kindOf = (it: ExplorerItem) => it.kind === 'space' ? 'Espace' : it.kind === 'folder' ? 'Dossier' : (KIND[extOf(it)] ?? 'Fichier')
function sizeOf(it: ExplorerItem) {
  const s = it.size ?? 0
  if (it.kind === 'file') return s >= 1048576 ? `${(s / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(s / 1024))} Ko`
  return it.kind === 'space' && it.size !== undefined ? `${s} élément${s > 1 ? 's' : ''}` : '—'
}
const dateFr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const isImage = (it: ExplorerItem) => ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(extOf(it))
// Address of a file's content: fileUrl, or resolveFileUrl (fetched content, e.g. behind an Authorization header)
const objectUrls: string[] = []
onBeforeUnmount(() => objectUrls.forEach(u => URL.revokeObjectURL(u)))
async function contentUrl(it: ExplorerItem, download = false): Promise<string> {
  if (props.adapter.resolveFileUrl) {
    const url = await props.adapter.resolveFileUrl(it, download)
    if (url.startsWith('blob:')) objectUrls.push(url)
    return url
  }
  return props.adapter.fileUrl?.(it, download) ?? ''
}
async function download(it: ExplorerItem) {
  try {
    const url = await contentUrl(it, true)
    Object.assign(document.createElement('a'), { href: url, download: it.name }).click()
  }
  catch (e) { error.value = msg(e) }
}

// --- Selection, opening ---
const selected = ref<string[]>([])
const isSel = (it: ExplorerItem) => selected.value.includes(key(it))
const selItems = computed(() => items.value.filter(isSel))
const status = computed(() => {
  const n = items.value.length
  const s = selected.value.length
  return `${n} élément${n > 1 ? 's' : ''}${s ? ` · ${s} sélectionné${s > 1 ? 's' : ''}` : ''}`
})
const pane = ref<HTMLElement | null>(null)
let anchor = ''
function select(it: ExplorerItem, e: MouseEvent) {
  const k = key(it)
  if (e.shiftKey && anchor) {
    const ks = items.value.map(key)
    const [a, b] = [ks.indexOf(anchor), ks.indexOf(k)].sort((x, y) => x - y) as [number, number]
    selected.value = ks.slice(a, b + 1)
  }
  else if (e.metaKey || e.ctrlKey) {
    selected.value = isSel(it) ? selected.value.filter(x => x !== k) : [...selected.value, k]
    anchor = k
  }
  else {
    selected.value = [k]
    anchor = k
  }
  pane.value?.focus()
}
const preview = ref<ExplorerItem | null>(null)
const previewUrl = ref('')
const previewOpen = ref(false)
async function showPreview(it: ExplorerItem) {
  try {
    previewUrl.value = await contentUrl(it)
    preview.value = it
    previewOpen.value = true
  }
  catch (e) { error.value = msg(e) }
}
function open(it: ExplorerItem) {
  if (it.kind === 'space') go({ space: it.id })
  else if (it.kind === 'folder') go({ space: it.spaceId ?? loc.value.space, folder: it.id })
  else if (it.previewable) showPreview(it)
  else download(it)
}

// --- Actions ---
async function call(fn: () => Promise<unknown>) {
  error.value = ''
  try { await fn() }
  catch (e) { error.value = msg(e) }
  await refresh()
}
const renaming = ref('')
const renameValue = ref('')
const renameInput = ref<HTMLInputElement[] | HTMLInputElement | null>(null)
const newInput = ref<HTMLInputElement[] | HTMLInputElement | null>(null)
const creating = ref<{ name: string } | null>(null)
function focusIn(r: () => HTMLInputElement[] | HTMLInputElement | null) {
  nextTick(() => {
    const v = r()
    const el = Array.isArray(v) ? v[0] : v
    el?.focus()
    el?.select()
  })
}
function startRename(it: ExplorerItem) {
  if (props.readonly || it.kind === 'space') return
  renaming.value = key(it)
  renameValue.value = it.name
  focusIn(() => renameInput.value)
}
async function commitRename(it: ExplorerItem) {
  if (renaming.value !== key(it)) return
  renaming.value = ''
  const name = renameValue.value.trim()
  if (name && name !== it.name) await call(() => props.adapter.rename(it, name))
}
function newFolder() {
  if (!canWrite.value) return
  creating.value = { name: 'Nouveau dossier' }
  focusIn(() => newInput.value)
}
async function commitNew() {
  const c = creating.value
  if (!c) return
  creating.value = null
  const name = c.name.trim()
  if (name) await call(() => props.adapter.createFolder(loc.value, name))
}
async function removeSel() {
  if (props.readonly) return
  const list = selItems.value.filter(i => i.kind !== 'space')
  if (!list.length) return
  const folders = list.some(i => i.kind === 'folder')
  if (!confirm(`Supprimer définitivement ${list.length > 1 ? `ces ${list.length} éléments` : `« ${list[0]!.name} »`}${folders ? ' (dossiers : tout leur contenu sera effacé)' : ''} ? Cette action est irréversible.`)) return
  await call(async () => {
    await props.adapter.remove(list)
    selected.value = []
  })
}

// --- Upload ---
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
async function upload(files: File[], target: ExplorerLocation = loc.value) {
  if (props.readonly || !files.length || target.space === undefined) return
  uploading.value = true
  error.value = ''
  notes.value = []
  try { notes.value = (await props.adapter.upload(target, files)).errors ?? [] }
  catch (e) { error.value = msg(e) }
  uploading.value = false
  await refresh()
}
// Exposed: refresh() after a change made outside the explorer; pickFiles() opens the file dialog (e.g. from a shortcut)
defineExpose({ refresh, pickFiles: () => { if (canWrite.value) fileInput.value?.click() } })
function onPick(e: Event) {
  const el = e.target as HTMLInputElement
  const files = [...(el.files ?? [])]
  el.value = ''
  upload(files)
}

// --- Drag and drop: files from the desktop (upload) and items (move) ---
const MIME = 'application/x-rocket-explorer-items'
const dropHint = ref('')
const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files')
function onDragStart(it: ExplorerItem, e: DragEvent) {
  if (props.readonly || it.kind === 'space') {
    e.preventDefault()
    return
  }
  if (!isSel(it)) selected.value = [key(it)]
  e.dataTransfer?.setData(MIME, JSON.stringify(selItems.value.filter(i => i.kind !== 'space').map(key)))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDragOverRoot(e: DragEvent) { if (hasFiles(e) && canWrite.value) dropHint.value = 'root' }
function onDragOverItem(it: ExplorerItem) { if (it.kind !== 'file') dropHint.value = key(it) }
const targetOf = (it: ExplorerItem): ExplorerLocation => it.kind === 'space' ? { space: it.id, folder: null } : { space: it.spaceId ?? loc.value.space, folder: it.id }
async function drop(target: ExplorerLocation, e: DragEvent) {
  dropHint.value = ''
  if (target.space === undefined) return
  if (hasFiles(e)) return upload([...(e.dataTransfer?.files ?? [])], target)
  if (props.readonly) return
  let keys: string[] = []
  try { keys = JSON.parse(e.dataTransfer?.getData(MIME) || '[]') }
  catch { /* nothing to move */ }
  const moved = items.value.filter(i => keys.includes(key(i)) && !(i.kind === 'folder' && i.id === target.folder))
  if (!moved.length) return
  if (!props.adapter.crossSpaceMove && moved.some(m => (m.spaceId ?? loc.value.space) !== target.space)) {
    error.value = 'Un élément reste dans son espace : le déplacement vers un autre espace n’est pas possible.'
    return
  }
  await call(() => props.adapter.move(moved, { space: target.space, folder: target.folder ?? null }))
}
function onDropRoot(e: DragEvent) { if (canWrite.value) drop({ space: loc.value.space, folder: loc.value.folder ?? null }, e) }
function onDropItem(it: ExplorerItem, e: DragEvent) { if (it.kind !== 'file') drop(targetOf(it), e) }
function onDropCrumb(c: Crumb, e: DragEvent) { if (!c.search && c.loc.space !== undefined) drop({ space: c.loc.space, folder: c.loc.folder ?? null }, e) }

// --- Tags: on the selection, and management (create, rename, recolour, delete) ---
const manageOpen = ref(false)
const tagError = ref('')
const newTag = reactive({ name: '', color: 'blue' })
async function setTag(id: ExplorerId, on: boolean) {
  const nodes = selItems.value.filter(i => i.kind !== 'space')
  if (props.readonly || !props.adapter.tags || !nodes.length) return
  await call(() => props.adapter.tags!.assign(nodes, on ? [id] : [], on ? [] : [id]))
  await refreshTags()
}
async function tagCall(fn: () => Promise<unknown>) {
  tagError.value = ''
  try { await fn() }
  catch (e) { tagError.value = msg(e) }
  await Promise.all([refreshTags(), refresh()])
}
function addTag() {
  if (!newTag.name.trim() || !props.adapter.tags) return
  tagCall(async () => {
    await props.adapter.tags!.create(newTag.name.trim(), newTag.color)
    newTag.name = ''
  })
}
const recolor = (t: ExplorerTag, color: string) => tagCall(() => props.adapter.tags!.update(t, { color }))
function renameTag(t: ExplorerTag, e: Event) {
  const input = e.target as HTMLInputElement
  const name = input.value.trim()
  if (name && name !== t.name) tagCall(() => props.adapter.tags!.update(t, { name }))
  else input.value = t.name
}
async function removeTag(t: ExplorerTag) {
  if (!confirm(`Supprimer l’étiquette « ${t.name} » ? Elle sera retirée de ${t.count ?? 0} élément(s) ; aucun fichier n’est supprimé.`)) return
  if (tagFilter.value === t.id) tagFilter.value = null
  await tagCall(() => props.adapter.tags!.remove(t))
}

// --- Keyboard and context menu ---
function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement).tagName === 'INPUT') return
  const one = selItems.value.length === 1 ? selItems.value[0]! : null
  if (e.key === ' ' && one?.kind === 'file' && one.previewable) {
    e.preventDefault()
    showPreview(one)
  }
  else if (e.key === 'Enter' && one) {
    e.preventDefault()
    startRename(one)
  }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && selItems.value.length) {
    e.preventDefault()
    removeSel()
  }
  else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    selected.value = items.value.map(key)
  }
  else if (e.key === 'Escape') {
    selected.value = []
  }
  else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
    e.preventDefault()
    const ks = items.value.map(key)
    const i = ks.indexOf(selected.value.at(-1) ?? '')
    const next = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? Math.min(ks.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1)
    if (ks[next]) {
      selected.value = [ks[next]!]
      anchor = ks[next]!
    }
  }
}
function onContextItem(it: ExplorerItem) { if (!isSel(it)) selected.value = [key(it)] }
function onContextBlank(e: MouseEvent) { if (e.target === pane.value) selected.value = [] }
const menuItems = computed(() => {
  const one = selItems.value.length === 1 ? selItems.value[0]! : null
  if (!selItems.value.length) {
    return [[
      { label: 'Nouveau dossier', icon: 'i-lucide-folder-plus', disabled: !canWrite.value, onSelect: newFolder },
      { label: 'Ajouter des fichiers…', icon: 'i-lucide-upload', disabled: !canWrite.value, onSelect: () => fileInput.value?.click() },
    ]]
  }
  const real = selItems.value.some(i => i.kind !== 'space') && !props.readonly
  const appActions = props.readonly ? [] : (props.adapter.actions?.(selItems.value) ?? [])
  const groups: Record<string, unknown>[][] = [
    [
      { label: 'Ouvrir', icon: 'i-lucide-folder-open', disabled: !one, onSelect: () => one && open(one) },
      { label: 'Aperçu', icon: 'i-lucide-eye', disabled: !one || one.kind !== 'file' || !one.previewable, onSelect: () => one && showPreview(one) },
      { label: 'Télécharger', icon: 'i-lucide-download', disabled: !one || one.kind !== 'file', onSelect: () => one && download(one) },
    ],
    [
      { label: 'Renommer', icon: 'i-lucide-pencil', disabled: !one || one.kind === 'space' || props.readonly, onSelect: () => one && startRename(one) },
      // Opened once the menu is closed (otherwise it stays displayed under the application's window)
      ...appActions.map(a => ({ label: a.label, icon: a.icon, disabled: a.disabled, onSelect: () => { const sel = [...selItems.value]; setTimeout(() => emit('action', a.id, sel), 50) } })),
      { label: 'Supprimer', icon: 'i-lucide-trash-2', color: 'error' as const, disabled: !real, onSelect: removeSel },
    ],
  ]
  if (props.adapter.tags) {
    groups.push([{
      label: 'Étiquettes', icon: 'i-lucide-tag', disabled: !real,
      children: [
        ...tags.value.map(t => ({ label: t.name, type: 'checkbox' as const, checked: selItems.value.every(i => i.tags?.some(x => x.id === t.id)), onUpdateChecked: (v: boolean) => setTag(t.id, v) })),
        ...(tags.value.length ? [{ type: 'separator' as const }] : []),
        { label: 'Gérer les étiquettes…', icon: 'i-lucide-settings-2', onSelect: () => { manageOpen.value = true } },
      ],
    }])
  }
  return groups
})
</script>

<template>
  <div
    class="flex min-h-[28rem] flex-col overflow-hidden rounded-lg border border-default bg-default" :style="{ height }"
    @dragover.prevent="onDragOverRoot" @dragleave.self="dropHint = ''" @drop.prevent="onDropRoot"
  >
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-1 border-b border-default bg-elevated/50 px-2 py-1.5">
      <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-chevron-left" :disabled="!canBack" aria-label="Précédent" @click="back" />
      <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-chevron-right" :disabled="!canForward" aria-label="Suivant" @click="forward" />
      <div class="mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-sm">
        <template v-for="(c, i) in crumbs" :key="i">
          <UIcon v-if="i" name="i-lucide-chevron-right" class="size-3.5 shrink-0 text-muted" />
          <button
            type="button" class="shrink-0 rounded px-1.5 py-0.5 hover:bg-elevated" :class="[i === crumbs.length - 1 ? 'font-semibold' : 'text-muted', dropHint === `crumb${i}` ? 'rfe-drop' : '']"
            @click="go(c.loc)" @dragover.prevent.stop="c.loc.space !== undefined && !c.search && (dropHint = `crumb${i}`)" @dragleave.stop="dropHint = ''" @drop.prevent.stop="onDropCrumb(c, $event)"
          >
            {{ c.label }}
          </button>
        </template>
        <UIcon v-if="loading" name="i-lucide-loader-circle" class="ml-1 size-3.5 animate-spin text-muted" />
      </div>
      <UInput v-model="query" size="sm" icon="i-lucide-search" placeholder="Rechercher" class="w-40 sm:w-52" :ui="{ trailing: 'pe-1' }">
        <template v-if="query" #trailing>
          <UButton size="xs" color="neutral" variant="link" icon="i-lucide-x" aria-label="Effacer" @click="query = ''" />
        </template>
      </UInput>
      <UFieldGroup size="sm">
        <UButton color="neutral" :variant="view === 'icons' ? 'solid' : 'outline'" icon="i-lucide-layout-grid" aria-label="Icônes" @click="view = 'icons'" />
        <UButton color="neutral" :variant="view === 'list' ? 'solid' : 'outline'" icon="i-lucide-list" aria-label="Liste" @click="view = 'list'" />
      </UFieldGroup>
      <UButton v-if="!readonly" size="sm" color="neutral" variant="outline" icon="i-lucide-folder-plus" label="Dossier" :disabled="!canWrite" @click="newFolder" />
      <UButton v-if="!readonly" size="sm" icon="i-lucide-upload" label="Ajouter" :disabled="!canWrite" :loading="uploading" @click="fileInput?.click()" />
      <input ref="fileInput" type="file" multiple class="hidden" @change="onPick">
    </div>

    <!-- Tags (a click filters) and the application's extra filter -->
    <div v-if="adapter.tags || adapter.filter" class="flex flex-wrap items-center gap-1.5 border-b border-default px-3 py-1.5 text-xs">
      <template v-if="adapter.tags">
        <span class="text-muted">Étiquettes :</span>
        <button
          v-for="t in tags" :key="t.id" type="button" class="flex items-center gap-1 rounded-full border px-2 py-0.5 hover:bg-elevated"
          :class="tagFilter === t.id ? 'border-primary bg-primary/15 font-medium' : 'border-default'" :aria-pressed="tagFilter === t.id" @click="toggleTagFilter(t.id)"
        >
          <span class="size-2 rounded-full" :class="DOT[t.color]" /> {{ t.name }} <span v-if="t.count !== undefined" class="text-muted">{{ t.count }}</span>
        </button>
        <span v-if="!tags.length" class="text-muted">aucune pour l’instant</span>
        <button v-if="!readonly" type="button" class="flex items-center gap-1 rounded-full px-2 py-0.5 text-muted hover:bg-elevated" @click="manageOpen = true">
          <UIcon name="i-lucide-settings-2" class="size-3" /> Gérer
        </button>
      </template>
      <USelect v-if="adapter.filter" v-model="filter" :items="filterItems" size="xs" class="ml-auto w-52" :aria-label="adapter.filter.label" />
    </div>

    <div class="flex min-h-0 flex-1">
      <!-- Sidebar: the spaces -->
      <aside v-if="!locked" class="hidden w-44 shrink-0 space-y-0.5 overflow-y-auto border-r border-default bg-elevated/30 p-2 text-sm sm:block">
        <button type="button" class="rfe-side" :class="{ on: loc.space === undefined }" @click="go({})">
          <UIcon name="i-lucide-hard-drive" /> {{ rootLabel }}
        </button>
        <button
          v-for="s in listing?.spaces ?? []" :key="s.id" type="button" class="rfe-side" :class="{ 'on': loc.space === s.id, 'rfe-drop': dropHint === `side${s.id}` }"
          @click="go({ space: s.id })" @dragover.prevent.stop="dropHint = `side${s.id}`" @dragleave.stop="dropHint = ''" @drop.prevent.stop="drop({ space: s.id, folder: null }, $event)"
        >
          <UIcon :name="s.icon ?? 'i-lucide-folder-closed'" /> <span class="truncate">{{ s.name }}</span>
        </button>
      </aside>

      <!-- Content -->
      <UContextMenu :items="menuItems" class="min-w-0 flex-1" :ui="{ content: 'min-w-44' }">
        <div ref="pane" class="relative h-full min-w-0 overflow-y-auto p-3 outline-none" tabindex="0" @click.self="selected = []" @keydown="onKey" @contextmenu="onContextBlank">
          <div v-if="dropHint === 'root'" class="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-primary">
            Déposer ici pour ajouter à « {{ here }} »
          </div>
          <p v-if="error" class="mb-2 rounded bg-error/10 px-2 py-1 text-sm text-error">{{ error }}</p>
          <ul v-if="notes.length" class="mb-2 space-y-0.5 rounded bg-warning/10 px-2 py-1 text-sm text-warning"><li v-for="n in notes" :key="n">{{ n }}</li></ul>

          <p v-if="listing && !items.length && !creating" class="py-16 text-center text-sm text-muted">
            <template v-if="searching">Aucun résultat.</template>
            <template v-else-if="loc.space === undefined">Aucun espace.</template>
            <template v-else>Dossier vide — glisse des fichiers ici, ou utilise « Ajouter ».</template>
          </p>

          <!-- Icons -->
          <div v-if="view === 'icons'" class="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-1">
            <div v-if="creating" class="rfe-cell">
              <UIcon name="i-lucide-folder" class="size-12 text-sky-500" />
              <input ref="newInput" v-model="creating.name" class="rfe-rename" @keydown.enter.prevent="commitNew" @keydown.esc.prevent="creating = null" @blur="commitNew">
            </div>
            <div
              v-for="it in items" :key="key(it)" class="rfe-cell" :class="{ 'sel': isSel(it), 'rfe-drop': dropHint === key(it) }" :draggable="!readonly"
              @click.stop="select(it, $event)" @dblclick.stop="open(it)" @contextmenu="onContextItem(it)" @dragstart="onDragStart(it, $event)"
              @dragover.prevent.stop="onDragOverItem(it)" @dragleave.stop="dropHint = ''" @drop.prevent.stop="onDropItem(it, $event)"
            >
              <UIcon :name="iconOf(it)" class="size-12" :class="colorOf(it)" />
              <input v-if="renaming === key(it)" ref="renameInput" v-model="renameValue" class="rfe-rename" @click.stop @dblclick.stop @keydown.enter.prevent="commitRename(it)" @keydown.esc.prevent="renaming = ''" @blur="commitRename(it)">
              <span v-else class="line-clamp-2 break-all text-center text-xs leading-tight">{{ it.name }}</span>
              <span v-for="(b, i) in it.badges ?? []" :key="i" class="line-clamp-1 rounded px-1 text-[10px]" :class="BADGE[b.color ?? 'neutral']" :title="b.title">{{ b.label }}</span>
              <span v-if="it.tags?.length" class="flex flex-wrap justify-center gap-0.5"><span v-for="t in it.tags" :key="t.id" class="size-2 rounded-full" :class="DOT[t.color]" :title="t.name" /></span>
              <span v-if="it.where" class="line-clamp-1 text-[10px] text-muted">{{ it.where }}</span>
            </div>
          </div>

          <!-- List -->
          <table v-else-if="items.length || creating" class="w-full text-sm">
            <thead class="text-left text-xs text-muted">
              <tr>
                <th v-for="c in cols" :key="c.k" class="cursor-pointer select-none whitespace-nowrap px-2 py-1 font-medium" :class="c.cls" @click="sortBy(c.k)">
                  {{ c.label }} <UIcon v-if="sort.key === c.k" :name="sort.dir === 1 ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 align-middle" />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="creating" class="rfe-row">
                <td class="px-2 py-1" colspan="4">
                  <span class="flex items-center gap-2"><UIcon name="i-lucide-folder" class="size-5 text-sky-500" />
                    <input ref="newInput" v-model="creating.name" class="rfe-rename !text-left" @keydown.enter.prevent="commitNew" @keydown.esc.prevent="creating = null" @blur="commitNew"></span>
                </td>
              </tr>
              <tr
                v-for="it in items" :key="key(it)" class="rfe-row" :class="{ 'sel': isSel(it), 'rfe-drop': dropHint === key(it) }" :draggable="!readonly"
                @click.stop="select(it, $event)" @dblclick.stop="open(it)" @contextmenu="onContextItem(it)" @dragstart="onDragStart(it, $event)"
                @dragover.prevent.stop="onDragOverItem(it)" @dragleave.stop="dropHint = ''" @drop.prevent.stop="onDropItem(it, $event)"
              >
                <td class="px-2 py-1">
                  <span class="flex min-w-0 items-center gap-2">
                    <UIcon :name="iconOf(it)" class="size-5 shrink-0" :class="colorOf(it)" />
                    <input v-if="renaming === key(it)" ref="renameInput" v-model="renameValue" class="rfe-rename !text-left" @click.stop @dblclick.stop @keydown.enter.prevent="commitRename(it)" @keydown.esc.prevent="renaming = ''" @blur="commitRename(it)">
                    <span v-else class="truncate">{{ it.name }}<span v-if="it.where" class="ml-2 text-xs text-muted">{{ it.where }}</span></span>
                    <span v-for="(b, i) in it.badges ?? []" :key="i" class="shrink-0 rounded px-1.5 text-[11px]" :class="BADGE[b.color ?? 'neutral']" :title="b.title">{{ b.label }}</span>
                    <span v-for="t in it.tags" :key="t.id" class="flex shrink-0 items-center gap-1 rounded-full border border-default px-1.5 text-[11px] text-muted"><span class="size-1.5 rounded-full" :class="DOT[t.color]" />{{ t.name }}</span>
                  </span>
                </td>
                <td class="whitespace-nowrap px-2 py-1 text-muted">{{ it.updatedAt ? dateFr(it.updatedAt) : '—' }}</td>
                <td class="whitespace-nowrap px-2 py-1 text-right text-muted">{{ sizeOf(it) }}</td>
                <td class="whitespace-nowrap px-2 py-1 text-muted">{{ kindOf(it) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UContextMenu>
    </div>

    <!-- Status bar -->
    <div class="flex items-center justify-between border-t border-default bg-elevated/50 px-3 py-1 text-xs text-muted">
      <span>{{ status }}</span>
      <span class="hidden sm:inline">Double-clic : ouvrir · Espace : aperçu · Entrée : renommer · Suppr : supprimer · Glisser-déposer : ajouter / déplacer</span>
    </div>

    <!-- Tag management -->
    <UModal v-if="adapter.tags" v-model:open="manageOpen" title="Étiquettes" description="Supprimer une étiquette ne supprime aucun fichier.">
      <template #body>
        <ul class="space-y-2">
          <li v-for="t in tags" :key="t.id" class="flex items-center gap-2">
            <span class="flex shrink-0 gap-1">
              <button v-for="c in tagColors" :key="c" type="button" class="size-4 rounded-full" :class="[DOT[c], t.color === c ? 'ring-2 ring-primary ring-offset-1 ring-offset-default' : '']" :aria-label="c" @click="recolor(t, c)" />
            </span>
            <UInput :model-value="t.name" size="sm" class="min-w-0 flex-1" :maxlength="30" @change="renameTag(t, $event)" />
            <span class="w-6 text-right text-xs text-muted">{{ t.count }}</span>
            <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Supprimer l’étiquette" @click="removeTag(t)" />
          </li>
          <li v-if="!tags.length" class="text-sm text-muted">Aucune étiquette.</li>
        </ul>
        <form class="mt-4 flex flex-wrap items-center gap-2 border-t border-default pt-3" @submit.prevent="addTag">
          <UInput v-model="newTag.name" size="sm" class="min-w-0 flex-1" placeholder="Nouvelle étiquette" :maxlength="30" />
          <span class="flex gap-1">
            <button v-for="c in tagColors" :key="c" type="button" class="size-4 rounded-full" :class="[DOT[c], newTag.color === c ? 'ring-2 ring-primary ring-offset-1 ring-offset-default' : '']" :aria-label="c" @click="newTag.color = c" />
          </span>
          <UButton type="submit" size="sm" label="Ajouter" :disabled="!newTag.name.trim()" />
        </form>
        <p v-if="tagError" class="mt-2 text-sm text-error">{{ tagError }}</p>
      </template>
    </UModal>

    <!-- Quick look -->
    <UModal v-model:open="previewOpen" :title="preview?.name" :ui="{ content: 'sm:max-w-4xl' }">
      <template #body>
        <div v-if="preview" class="flex min-h-64 items-center justify-center">
          <img v-if="isImage(preview)" :src="previewUrl" :alt="preview.name" class="max-h-[70vh] max-w-full rounded">
          <iframe v-else :src="previewUrl" class="h-[70vh] w-full rounded border border-default" :title="`Aperçu de ${preview.name}`" />
        </div>
      </template>
      <template #footer>
        <UButton v-if="preview" color="neutral" variant="outline" icon="i-lucide-download" label="Télécharger" @click="download(preview)" />
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.rfe-side { display: flex; width: 100%; align-items: center; gap: 0.5rem; border-radius: 0.375rem; padding: 0.25rem 0.5rem; text-align: left; }
.rfe-side:hover { background: var(--ui-bg-elevated); }
.rfe-side.on { background: color-mix(in oklab, var(--ui-primary) 18%, transparent); font-weight: 600; }
.rfe-drop { outline: 2px solid var(--ui-primary); outline-offset: -2px; }
.rfe-cell { display: flex; cursor: default; flex-direction: column; align-items: center; gap: 0.25rem; border-radius: 0.5rem; padding: 0.5rem 0.25rem; user-select: none; }
.rfe-cell:hover, .rfe-row:hover { background: var(--ui-bg-elevated); }
.rfe-cell.sel, .rfe-row.sel { background: color-mix(in oklab, var(--ui-primary) 22%, transparent); }
.rfe-row { cursor: default; user-select: none; }
.rfe-rename { width: 100%; min-width: 0; border-radius: 0.25rem; border: 1px solid var(--ui-primary); background: var(--ui-bg); padding: 0 0.25rem; text-align: center; font-size: 0.75rem; outline: none; }
</style>
