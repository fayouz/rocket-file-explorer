# Changelog

Format [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté
- `resolveFileUrl` : adresse du contenu obtenue de façon asynchrone (contenu protégé par un en-tête Authorization, adresse blob: révoquée par l'explorateur) ; `fileUrl` devient facultatif.
- Événement `changed` après chaque modification ; alias `#file-explorer` pour les types (fonctionne depuis node_modules comme depuis une copie locale).
- `pickFiles()` exposé : ouvre la fenêtre de choix des fichiers (raccourci « Déposer des fichiers »).
- `v-model:location` : l'emplacement suit la page (dossier dans l'URL, bouton Précédent du navigateur).
- `RocketFileExplorer` : explorateur façon Finder (icônes ou liste, tri, fil d'Ariane, précédent / suivant, recherche, étiquettes, filtre de l'application, badges, glisser-déposer, menu contextuel, raccourcis clavier, aperçu rapide), issu de l'explorateur de LoussaHousing.
- Contrat d'adaptateur (`@rocket/file-explorer/types`) : aucun appel serveur dans le composant.
- Bac à sable avec un adaptateur en mémoire.
