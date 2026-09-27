# @rocket/file-explorer

Explorateur de fichiers façon Finder, réutilisable dans toute application Nuxt 4 + Nuxt UI 4 (Rocket Cloud, Rocket PMS, LoussaHousing…) : icônes ou liste, fil d'Ariane, précédent / suivant, recherche, étiquettes, filtre propre à l'application, glisser-déposer (dépôt depuis le bureau et déplacement), menu contextuel, raccourcis clavier, aperçu rapide.

**Il ne connaît aucun serveur** : chaque opération passe par un **adaptateur** fourni par l'application (types : `import type … from '#file-explorer'`).

## Installation

```json
// package.json
"dependencies": { "@rocket/file-explorer": "github:fayouz/rocket-file-explorer#semver:^0.1.0" }
```

```ts
// nuxt.config.ts : l'application fournit déjà @nuxt/ui
export default defineNuxtConfig({
  extends: ['@rocket/file-explorer'],
})
```

## Utilisation

```vue
<script setup lang="ts">
import type { ExplorerAdapter } from '#file-explorer'

const adapter: ExplorerAdapter = {
  rootLabel: 'Documents',
  list: (location, query) => $fetch('/api/explorer/list', { query: { space: location.space, folder: location.folder, ...query } }),
  createFolder: (location, name) => $fetch('/api/explorer/folders', { method: 'POST', body: { ...location, name } }),
  upload: async (location, files) => { /* multipart */ return { errors: [] } },
  rename: (item, name) => $fetch(`/api/explorer/${item.id}`, { method: 'PATCH', body: { name } }),
  move: async (items, target) => { /* … */ },
  remove: async (items) => { /* … */ },
  fileUrl: (item, download) => `/api/explorer/${item.id}/file${download ? '?download=1' : ''}`,
}
</script>

<template>
  <RocketFileExplorer :adapter="adapter" height="calc(100vh - 12rem)" @action="(id, items) => {}" />
</template>
```

| Prop | Rôle |
|---|---|
| `adapter` | Opérations (voir `app/types/explorer.ts`) |
| `space` | Verrouille l'explorateur sur un espace (pas de barre latérale) |
| `readonly` | Consultation seule (le serveur doit aussi refuser) |
| `height` | Hauteur (défaut `32rem`) |
| `v-model:location` | Emplacement (espace, dossier) suivi par la page, par exemple `?folder=` dans l'URL |

Options de l'adaptateur :
- **Espaces** : racines de premier niveau (un logement, l'espace personnel…), listés dans la barre latérale. `crossSpaceMove` autorise le déplacement entre espaces.
- **Étiquettes** (`tags`) : filtre, pose sur la sélection, gestion (créer, renommer, recolorer, supprimer).
- **Filtre** (`filter`) : une liste déroulante propre à l'application (types de documents…), passée à `list()` en `query.filter`.
- **Badges** (`item.badges`) : petites étiquettes affichées sur un élément (type, statut…).
- **Actions** (`actions(items)`) : entrées ajoutées au menu contextuel ; l'explorateur émet `action` (id, éléments) et l'application ouvre sa propre fenêtre.
- `fileUrl(item, download)` ou `resolveFileUrl(item, download)` : adresse du contenu ; la seconde, asynchrone, sert quand le contenu exige un en-tête `Authorization` (elle renvoie par exemple une adresse `blob:`).
- `errorMessage(e)` : message lisible des erreurs.

L'explorateur émet `changed` après chaque modification et expose `refresh()` et `pickFiles()` (par `ref`).

Pour travailler sur le module et une application à la fois : `ROCKET_FILE_EXPLORER_LAYER=/chemin/rocket-file-explorer` si l'application l'étend ainsi (comme `ROCKET_CORE_LAYER`).

## Développement

```bash
npm install
npm run dev          # bac à sable (playground/) sur un adaptateur en mémoire
npm run lint && npm run typecheck
```

## Versions

Semver par tags `vX.Y.Z`, créés depuis GitHub. Gitflow : `main`, `develop`, `feature/*`.
