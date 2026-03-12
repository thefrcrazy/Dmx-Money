# DmxMoney (Desktop Version)

DmxMoney est une application de gestion financière personnelle moderne, performante et sécurisée, conçue pour macOS et Windows. Elle repose sur une architecture hybride alliant la puissance de **Rust** et la flexibilité de **React**.

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

## 🚀 Installation

###  macOS (Intel & Apple Silicon)

Comme l'application est Open Source et n'est pas signée avec un certificat Apple Developer payant, macOS affichera un message indiquant qu'elle est "endommagée" ou que le développeur est inconnu.

Pour l'installer correctement :

1. Téléchargez le fichier `.dmg` depuis les [Releases](https://github.com/thefrcrazy/Dmx-Money/releases).

2. Ouvrez le `.dmg` et faites glisser **DmxMoney** dans votre dossier **Applications**.

3. Ouvrez votre **Terminal** (via Spotlight ou Dossier Utilitaires).

4. Copiez et collez la commande suivante, puis appuyez sur Entrée :

   ```bash

   xattr -cr "/Applications/DmxMoney.app"

   ```

5. Vous pouvez maintenant lancer l'application normalement.

### ⊞ Windows

Téléchargez le fichier `.msi` ou le setup `.exe` et lancez l'installation. Si Windows SmartScreen affiche une alerte, cliquez sur "Informations complémentaires" puis "Exécuter quand même".

### 🐧 Linux

Téléchargez le fichier `.AppImage`, rendez-le exécutable (`chmod +x`) et lancez-le.

---

## 🛠️ Stack Technologique
