# DmxMoney

DmxMoney est une application desktop de gestion financière personnelle, construite avec Tauri, Rust, React et SQLite. Elle stocke les données en local, propose un journal de transactions complet, des budgets, un échéancier, des analyses et un système de mise à jour signé via GitHub Releases.

Version actuelle du projet : `1.0.6`.

## Points Forts

- Gestion multi-comptes avec groupes, ordre personnalisé, icônes et couleurs.
- Journal des transactions avec revenus, dépenses, virements liés, pointage, filtres, recherche et suivi du budget restant.
- Budgets mensuels par catégorie, éventuellement liés à un compte ou à des échéances.
- Échéancier avec fréquences avancées, date de fin, virements récurrents et génération automatique des opérations dues.
- Tableaux de bord, analyses par catégorie et prévisions de solde.
- Import CSV, QIF et OFX avec mapping, aperçu, création de compte et détection de doublons simples.
- Export/import `.dmx` pour sauvegarde locale ou fusion de données.
- Thèmes clair/sombre/système, couleur d'accent personnalisée et restauration de la fenêtre.
- Auto-update Tauri v2 avec signatures et artefacts séparés par plateforme.

## Plateformes

| Plateforme | Build | Notes |
| --- | --- | --- |
| macOS Apple Silicon | Modern | Vite/Rolldown, React 19, Tailwind CSS v4. |
| macOS Intel / Catalina | Legacy | Target macOS `10.15`, bundle SystemJS legacy, Tailwind CSS v3, polyfills Safari 13. |
| Windows x64 | Modern | Update via setup NSIS signé, pas via archive MSI zip. |
| Linux x64 | Modern | AppImage publié dans les releases. |

## Installation

Télécharge la dernière version depuis les [GitHub Releases](https://github.com/thefrcrazy/Dmx-Money/releases).

### macOS

1. Télécharge le `.dmg` correspondant à ton architecture.
2. Glisse `DmxMoney.app` dans `Applications`.
3. Si macOS indique que l'app est endommagée ou vient d'un développeur non identifié, lance :

```bash
xattr -cr "/Applications/DmxMoney.app"
```

4. Ouvre ensuite l'application normalement.

Pour un vieux Mac Intel sous Catalina, prends l'artefact Intel/x64. Les builds Apple Silicon restent modern et ne sont pas destinés à ces machines.

### Windows

Télécharge le setup `.exe` et lance l'installation. Si SmartScreen bloque l'ouverture, clique sur `Informations complémentaires`, puis `Exécuter quand même`.

### Linux

Télécharge l'AppImage, rends-la exécutable, puis lance-la :

```bash
chmod +x DmxMoney_*.AppImage
./DmxMoney_*.AppImage
```

## Architecture

```text
.
├── src/                  # Frontend React/TypeScript
├── src-tauri/            # Backend Tauri/Rust, SQLite, configuration desktop
├── config-presets/       # Presets modern et legacy pour Vite/Tailwind
├── .github/workflows/    # Pipeline de release
├── CHANGELOG.md          # Notes de version publiques
└── switch-tailwind.sh    # Bascule modern/legacy utilisée par la release
```

### Frontend

- `src/App.tsx` assemble les providers et les pages principales.
- `src/layouts/Layout.tsx` gère la navigation, le filtre global par compte et les soldes.
- `src/context/BankContext.tsx` contient la logique métier côté UI : comptes, transactions, virements, budgets, échéances et génération des opérations dues.
- `src/context/SettingsContext.tsx` applique les thèmes, couleurs, tailles/positions de fenêtre et notes de version.
- `src/services/db.ts` centralise les appels Tauri vers Rust.
- `src/utils/importParsers.ts` parse CSV/QIF/OFX et filtre les doublons.
- `src/hooks/useUpdater.ts` lance la vérification silencieuse des mises à jour et l'installation manuelle.

### Backend

- `src-tauri/src/db.rs` initialise SQLite dans le dossier de données Tauri, active `foreign_keys`, définit un `busy_timeout`, crée les tables et applique les migrations légères.
- `src-tauri/src/commands.rs` expose les commandes Tauri pour les comptes, transactions, catégories, budgets, échéances, settings et imports.
- `src-tauri/src/models.rs` définit les structures sérialisées entre Rust et React.
- `src-tauri/tauri.conf.json` configure l'identité de l'app, le bundle, le CSP, les plugins et l'updater signé.

Les données utilisateur restent locales dans la base SQLite `dmxmoney2025.db`. Le fichier `.dmx` est un export JSON de sauvegarde/fusion, pas un chiffrement.

## Stack

- Tauri `2.11`
- Rust `1.77.2+`
- SQLite via `sqlx`
- React `19`
- TypeScript `5`
- Vite `8`
- Tailwind CSS v4 en modern, Tailwind CSS v3 en legacy
- Recharts pour les graphiques
- Lucide React pour l'iconographie
- Bun pour les scripts et dépendances frontend

## Développement

### Prérequis

- Bun
- Rust stable
- Dépendances système Tauri pour la plateforme ciblée

Installation :

```bash
bun install
```

Lancement web uniquement :

```bash
bun run dev
```

Lancement desktop Tauri :

```bash
bun tauri dev
```

Vérifications utiles :

```bash
bun run lint
bun test
bun tsc --noEmit
cargo check --manifest-path src-tauri/Cargo.toml
```

Build local modern :

```bash
./switch-tailwind.sh modern
bun tauri build
```

Build local legacy Intel/Catalina :

```bash
./switch-tailwind.sh legacy
MACOSX_DEPLOYMENT_TARGET=10.15 bun tauri build --target x86_64-apple-darwin
```

`switch-tailwind.sh` modifie les fichiers de configuration Vite/Tailwind et peut toucher les dépendances. Vérifie toujours le diff après l'avoir utilisé.

## Release Et Updater

Le workflow `.github/workflows/release.yml` se déclenche sur les tags `v*`.

Il exécute les étapes suivantes :

1. Création d'une release GitHub en brouillon.
2. Build matriciel Apple Silicon, Intel macOS, Windows et Linux.
3. Bascule automatique du preset :
   - `legacy` pour macOS Intel/x64.
   - `modern` pour Apple Silicon, Windows et Linux.
4. Signature des artefacts updater avec la clé Tauri.
5. Upload des installateurs et signatures.
6. Génération de `latest.json`.
7. Publication de la release.

L'updater lit :

```text
https://github.com/thefrcrazy/Dmx-Money/releases/latest/download/latest.json
```

Les clés de plateforme utilisées par `latest.json` sont :

- `darwin-aarch64`
- `darwin-x86_64`
- `windows-x86_64`
- `linux-x86_64`

Sur Windows, l'artefact de mise à jour est le setup NSIS signé (`*_setup.exe`) afin d'éviter le chemin fragile de téléchargement/décompression d'un `.msi.zip`.

## Versioning

- La version principale est dans `package.json`.
- `src-tauri/tauri.conf.json` référence `../package.json`, donc Tauri reprend cette version.
- `src-tauri/Cargo.toml` garde aussi la version crate alignée.
- Les notes visibles dans l'app sont dans `src/constants/changelog.ts`.
- Les notes publiques sont dans `CHANGELOG.md`.
- L'interface lit la version via Tauri au runtime, pour éviter les versions affichées en dur.

## Compatibilité Legacy macOS

Le support Catalina/Intel repose sur plusieurs garde-fous :

- Build `x86_64-apple-darwin` séparé.
- `MACOSX_DEPLOYMENT_TARGET=10.15`.
- Preset legacy avec `@vitejs/plugin-legacy`, `renderModernChunks: false`, target Safari 13 et polyfills.
- Correction de l'URL SystemJS pour charger les assets via `tauri://localhost/assets/...`.
- CSP Tauri adaptée aux scripts/styles legacy nécessaires au bootstrap.
- Polyfill `MediaQueryList.addEventListener` pour Safari 13.

Les builds modern restent conservés pour les Mac Apple Silicon.

## Fichiers Importés Et Sauvegardes

Formats supportés :

- `.dmx` : export complet DmxMoney.
- `.csv` : import bancaire avec mapping manuel des colonnes.
- `.qif` : import bancaire QIF.
- `.ofx` : import bancaire OFX.

Pendant l'import bancaire, l'application peut ignorer les doublons évidents en comparant date, compte, type, montant et description normalisée.

## Licence

MIT.
