# DmxMoney 2025 (Desktop Version)

DmxMoney 2025 est une application de gestion financière personnelle moderne, performante et sécurisée, conçue pour macOS et Windows. Elle repose sur une architecture hybride alliant la puissance de **Rust** et la flexibilité de **React**.

---

## 🛠️ Stack Technologique

- **Runtime & Package Manager** : [Bun](https://bun.sh) (vitesse d'exécution et d'installation).
- **Core (Backend)** : [Tauri v2](https://tauri.app) (Rust) pour la gestion des fenêtres, du système de fichiers et des mises à jour.
- **Base de Données** : [SQLite](https://www.sqlite.org) via `sqlx` (Rust), garantissant performance et intégrité des données locales.
- **Frontend** :
    - [React 19](https://react.dev) (Composants fonctionnels).
    - [Vite](https://vitejs.dev) (Bundler ultra-rapide).
    - [TypeScript](https://www.typescriptlang.org) (Sécurité du typage).
- **Styling** :
    - [Tailwind CSS v4](https://tailwindcss.com) (Mode Modern) avec support natif des thèmes.
    - Support Legacy (Tailwind v3) pour compatibilité macOS Catalina.
    - [Lucide React](https://lucide.dev) pour l'iconographie.

---

## 🏗️ Architecture du Code

### Backend (Rust - `src-tauri/`)
Le backend est responsable de la logique critique, de la persistance et de la sécurité.
- **`main.rs` & `lib.rs`** : Point d'entrée. Initialise les plugins (`updater`, `fs`, `dialog`), configure la fenêtre (avec gestion spécifique des Traffic Lights sur macOS) et lance le runtime.
- **`db.rs`** : Gestionnaire de base de données.
    - Initialise le fichier SQLite `dmxmoney2025.db` dans le dossier utilisateur.
    - Gère les **migrations automatiques** au démarrage (création de tables, ajout de colonnes).
    - Utilise des **transactions SQL** pour garantir l'atomicité des opérations critiques (import, suppression de compte).
- **`commands.rs`** : Interface API exposée au frontend.
    - Chaque fonction (`add_transaction`, `get_settings`, etc.) est une commande Tauri asynchrone.
    - Renvoie des erreurs structurées et traduites pour une meilleure expérience utilisateur.
- **`models.rs`** : Définitions des structures de données (Structs) mappées sur les tables SQL.

### Frontend (React - `src/`)
L'interface est construite autour de Contextes pour la gestion d'état globale.
- **Contextes (`src/context/`)** :
    - `BankContext` : Gère les données métiers (comptes, transactions, budget).
    - `SettingsContext` : Gère le thème (Clair/Sombre), la couleur d'accentuation (avec génération dynamique des nuances), et la position de la fenêtre.
    - `ToastContext` : Système de notification global non-bloquant.
- **Pages (`src/pages/`)** :
    - `Dashboard` : KPIs, graphiques récapitulatifs.
    - `Transactions` : Tableau de bord principal avec **édition inline**, **multi-sélection** et filtres avancés.
    - `Analytics` : Graphiques de dépenses et d'évolution du solde (optimisés pour le rendu instantané).
- **Composants UI (`src/components/ui/`)** : Bibliothèque de composants réutilisables (Table, Button, Modal, Input) stylisés avec Tailwind.

---

## ✨ Fonctionnalités Clés

### 1. Gestion Financière Complète
- **Transactions** : Ajout, modification (inline), suppression, pointage.
- **Multi-comptes** : Filtrage global par compte ou vue agrégée.
- **Catégories** : Gestion personnalisable avec couleurs et icônes.
- **Budget & Échéancier** : Suivi des dépenses récurrentes et prévisionnelles.

### 2. Import / Export
- **Formats supportés** : OFX, QIF, CSV.
- **Logique intelligente** : Détection automatique des doublons, mappage des catégories, création de comptes à la volée.
- **Backup** : Export complet de la base de données au format `.dmx` (JSON chiffré).

### 3. Interface Utilisateur (UI/UX)
- **Thèmes** : Support Clair/Sombre automatique ou manuel.
- **Couleur d'accentuation** : Personnalisable par l'utilisateur, appliquée partout.
- **Sidebar Rétractable** : Optimisation de l'espace de travail.
- **Performance** : Animations fluides (View Transitions API), chargement asynchrone, virtualisation.

### 4. Mise à jour Automatique
- Système d'auto-update intégré (vérification au démarrage + manuelle).
- Signature cryptographique des mises à jour (Ed25519) pour la sécurité.
- Hébergement via GitHub Releases.

---

## 🚀 Guide de Développement

### Pré-requis
- **Bun** installé (`curl -fsSL https://bun.sh/install | bash`).
- **Rust** installé (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`).

### Installation
```bash
git clone https://github.com/thefrcrazy/Dmx-Money.git
cd dmxmoney-2025
bun install
```

### Lancer en développement
```bash
bun tauri dev
```

### Compilation (Production)
Le projet utilise GitHub Actions pour compiler automatiquement les versions Windows (.exe) et macOS (.dmg).
Pour déclencher une release manuellement en local :
```bash
bun tauri build
```

---

## 🔄 Gestion des Modes (Tailwind v3 vs v4)
Le projet supporte deux configurations CSS pour assurer la compatibilité avec les anciens macOS.
- **Modern (Défaut)** : Tailwind v4, `@theme` CSS variables, build natif.
- **Legacy** : Tailwind v3, `postcss`, compatibilité Safari 13.

Pour basculer :
```bash
./switch-tailwind.sh modern  # ou legacy
```

---

## 🔒 Sécurité
- **Permissions FS** : L'accès au disque est strictement limité au fichier de base de données et aux fichiers d'import dans les dossiers `Documents` et `Downloads`.
- **Isolation** : Le frontend ne peut pas exécuter de code arbitraire sur le système (CSP strict).
- **Sanitisation** : Toutes les entrées SQL sont paramétrées pour éviter les injections.