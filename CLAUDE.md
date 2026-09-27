# @rocket/file-explorer

Layer Nuxt 4 (Nuxt UI 4 fourni par l'application hôte) : le composant `app/components/RocketFileExplorer.vue` et le contrat `app/types/explorer.ts`. Utilisé par Rocket Cloud, Rocket PMS (via Rocket Cloud) et LoussaHousing.

## Repères
- Aucun appel serveur dans le composant : tout passe par l'adaptateur (`ExplorerAdapter`). Ajouter une capacité = un champ optionnel de l'adaptateur, jamais une URL en dur.
- Rétrocompatible dans une version mineure : chaque application dépend de ce contrat.
- Classes Tailwind complètes dans le code (pas de noms assemblés) ; styles propres préfixés `rfe-`.
- `playground/` : bac à sable sur un adaptateur en mémoire (`npm run dev`, port 3800 dans le launch.json de Faez).

## Vérifier avant de pousser
```bash
npm run lint && npm run typecheck
```

## Pièges connus
- Cache npm global en erreur de droits sur le Mac de Faez : `npm install --cache <dossier temporaire>`.
- Dépôt public (Rocket Cloud, public, l'installe) : rien de propre à un client ou à ses données ici.
