import { fileURLToPath } from 'node:url'

// Layer Nuxt @rocket/file-explorer : le composant RocketFileExplorer et ses types (import type … from '#file-explorer').
// L'application hôte fournit Nuxt UI 4 (composants UButton, UModal, UContextMenu…) et un adaptateur.
export default defineNuxtConfig({
  alias: {
    '#file-explorer': fileURLToPath(new URL('./app/types/explorer', import.meta.url)),
  },
})
