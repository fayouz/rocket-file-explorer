/**
 * Contract between the explorer and the application that uses it. The explorer never calls a server itself: every
 * operation goes through the adapter, so the same component works on LoussaHousing (one space per property),
 * Rocket Cloud (one personal space), Rocket PMS (through Rocket Cloud)…
 */

export type ExplorerId = string | number

/** A space is a top-level root (a property, a personal space…); folders and files live in a space. */
export interface ExplorerSpace {
  id: ExplorerId
  name: string
  icon?: string
}

export interface ExplorerTag {
  id: ExplorerId
  name: string
  /** One of the adapter's tag colours (red, orange, amber, green, teal, blue, violet, pink, gray). */
  color: string
  count?: number
}

/** Small label shown on an item (a document type, a status…). */
export interface ExplorerBadge {
  label: string
  color?: 'neutral' | 'success' | 'warning' | 'error' | 'info'
  title?: string
}

export interface ExplorerItem {
  id: ExplorerId
  kind: 'space' | 'folder' | 'file'
  name: string
  /** Bytes for a file; number of elements for a space (optional). */
  size?: number
  updatedAt?: string | null
  parentId?: ExplorerId | null
  spaceId?: ExplorerId
  /** Lower-case extension of a file (icon, kind). Derived from the name when missing. */
  ext?: string
  /** The browser can show it (PDF, image…): opened in the quick look instead of being downloaded. */
  previewable?: boolean
  /** Where it is (search results across folders): "Property / Folder". */
  where?: string
  tags?: ExplorerTag[]
  badges?: ExplorerBadge[]
}

/** Where the explorer is: a space (or the list of spaces when undefined), and a folder of it (root when null). */
export interface ExplorerLocation {
  space?: ExplorerId
  folder?: ExplorerId | null
}

/** Search and filters: a set query switches the explorer to search results (in the space, or everywhere). */
export interface ExplorerQuery {
  q?: string
  tag?: ExplorerId | null
  /** Value of the adapter's extra filter (see ExplorerAdapter.filter). */
  filter?: string | null
}

export interface ExplorerListing {
  /** The space shown, with the folders from its root to the current folder. */
  space?: ExplorerSpace | null
  path?: { id: ExplorerId, name: string }[]
  /** Every space (sidebar, and the items of the top level). */
  spaces?: ExplorerSpace[]
  items: ExplorerItem[]
}

export interface ExplorerSelectItem {
  label: string
  value?: string
  type?: 'label'
}

/** Application action shown in the context menu; the explorer emits "action" with its id and the selected items. */
export interface ExplorerAction {
  id: string
  label: string
  icon?: string
  disabled?: boolean
}

export interface ExplorerTagFeature {
  colors: string[]
  list(): Promise<ExplorerTag[]>
  create(name: string, color: string): Promise<void>
  update(tag: ExplorerTag, changes: { name?: string, color?: string }): Promise<void>
  remove(tag: ExplorerTag): Promise<void>
  /** Adds and/or removes tags on items. */
  assign(items: ExplorerItem[], add: ExplorerId[], remove: ExplorerId[]): Promise<void>
}

export interface ExplorerAdapter {
  /** Label of the top level (list of spaces), e.g. "Documents". */
  rootLabel?: string
  list(location: ExplorerLocation, query: ExplorerQuery): Promise<ExplorerListing>
  createFolder(location: ExplorerLocation, name: string): Promise<void>
  /** Returns the files refused (with the reason), the others being added. */
  upload(location: ExplorerLocation, files: File[]): Promise<{ errors?: string[] }>
  rename(item: ExplorerItem, name: string): Promise<void>
  move(items: ExplorerItem[], target: ExplorerLocation): Promise<void>
  remove(items: ExplorerItem[]): Promise<void>
  /** Address of a file's content (quick look, download), when the browser can load it as is (session cookie…). */
  fileUrl?(item: ExplorerItem, download?: boolean): string
  /**
   * Instead of fileUrl, when the content needs something a plain address cannot carry (an Authorization header):
   * returns an address the browser can load, typically a blob: URL of the fetched content (revoked by the explorer).
   */
  resolveFileUrl?(item: ExplorerItem, download?: boolean): Promise<string>
  /** Items may move from one space to another (false: refused with a message). */
  crossSpaceMove?: boolean
  tags?: ExplorerTagFeature
  /** Extra filter select next to the tags (e.g. document types); its value is passed as query.filter. */
  filter?: { label: string, placeholder?: string, items: ExplorerSelectItem[][] }
  /** Application actions of the context menu for the selection. */
  actions?: (items: ExplorerItem[]) => ExplorerAction[]
  /** Readable message of an error thrown by the adapter. */
  errorMessage?: (error: unknown) => string
}
