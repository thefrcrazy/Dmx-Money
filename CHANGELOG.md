# Changelog

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
