# Changelog

## 1.0.6 - 2026-05-21

- Ajout de transactions fictives dans Prédictions pour simuler des dépenses, revenus ou virements sans modifier le journal.
- Édition et suppression des simulations directement depuis la page Prédictions.
- Activation/désactivation individuelle des simulations via checkbox pour tester rapidement plusieurs scénarios.
- Conservation locale des simulations et compatibilité avec les anciennes simulations déjà enregistrées.

## 1.0.5 - 2026-05-18

- Correction du chargement SystemJS legacy sur macOS Catalina.
- Forçage de l'URL du bundle legacy vers `tauri://localhost/assets/...` dans le vieux WebKit.
- Conservation de Vite 8/Rolldown pour les builds modern et Apple Silicon.
- Build Mac Intel toujours réservé au preset legacy.

## 1.0.4 - 2026-05-18

- Correction du blocage CSP sur Mac Intel/Catalina.
- Autorisation explicite des assets `tauri://assets/...` dans la politique de sécurité.
- Conservation de l'inline CSS/JS nécessaire au bootstrap legacy SystemJS.
- Désactivation ciblée de la réécriture CSP Tauri sur `script-src` et `style-src`.

## 1.0.3 - 2026-05-18

- Correction du démarrage Mac Intel/Catalina avec assets Tauri/Vite en chemins relatifs.
- Séparation plus nette du build modern et du build legacy Intel.
- Suppression du bootstrap legacy inutile dans le build modern.
- Parsers CSV, QIF et OFX centralisés et plus tolérants.
- Ignorance des doublons évidents lors des imports bancaires.
- Suppression cohérente des deux lignes d'un virement lié.
- Activation de garde-fous SQLite et CSP Tauri plus stricte.
- Correction du libellé backup : le `.dmx` est un export local encodé, pas un chiffrement.

## 1.0.2 - 2026-05-18

- Remplacement du flux de mise à jour Windows par un setup NSIS signé directement.
- Suppression du chemin de mise à jour Windows basé sur un `.msi.zip` à décompresser.
- Conservation du build modern pour macOS Apple Silicon.
- Build legacy-only réservé aux Mac Intel/Catalina.
- Ajout d'un garde-fou contre l'écran de chargement infini au démarrage.
- Centralisation de l'état de l'updater pour éviter les vérifications concurrentes.
- Suppression des versions affichées en dur dans l'interface.
