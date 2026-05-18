# Changelog

## 1.0.2 - 2026-05-18

- Remplacement du flux de mise à jour Windows par un setup NSIS signé directement.
- Suppression du chemin de mise à jour Windows basé sur un `.msi.zip` à décompresser.
- Conservation du build modern pour macOS Apple Silicon.
- Build legacy-only réservé aux Mac Intel/Catalina.
- Ajout d'un garde-fou contre l'écran de chargement infini au démarrage.
- Centralisation de l'état de l'updater pour éviter les vérifications concurrentes.
- Suppression des versions affichées en dur dans l'interface.
