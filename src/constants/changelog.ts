export interface VersionUpdate {
    version: string;
    date: string;
    title: string;
    changes: string[];
    features?: {
        title: string;
        description: string;
        icon: string;
    }[];
}

export const CHANGELOG: VersionUpdate[] = [
    {
        version: "0.5.1",
        date: "2026-02-11",
        title: "Compatibilité Catalina & Optimisation",
        changes: [
            "Correction du crash au démarrage sur macOS Catalina (Intel)",
            "Renforcement de la transpilation Legacy pour les anciens moteurs WebKit",
            "Suppression des systèmes de cache de build instables",
            "Optimisation de la minification pour Safari"
        ],
        features: []
    },
    {
        version: "0.5.0",
        date: "2026-02-11",
        title: "Mise à jour majeure : Stabilité macOS",
        changes: [
            "Refonte du système de démarrage pour une stabilité maximale sur macOS",
            "Suppression définitive du flash blanc pour les utilisateurs en mode sombre",
            "Restauration intelligente de la taille et position de la fenêtre après le chargement",
            "Nettoyage complet de l'interface utilisateur pour un look plus épuré",
            "Optimisation des permissions système pour la gestion des fenêtres"
        ],
        features: []
    },
    {
        version: "0.4.7",
        changes: [
            "Splash screen repassé en 400x400 pour une transition plus stable",
            "Correction du bug d'interface écrasée après le démarrage",
            "Restauration garantie des bordures et contrôles de fenêtre",
            "Amélioration visuelle du logo et du spinner de chargement"
        ],
        features: []
    },
    {
        version: "0.4.5",
        date: "2026-02-11",
        title: "Perfectionnement du démarrage",
        changes: [
            "Correction de la taille du splash screen (120x120)",
            "Activation des ombres natives au démarrage",
            "Intégration du logo Or & Argent dans toute l'interface",
            "Stabilisation de la transition et des bordures de fenêtre"
        ],
        features: []
    },
    {
        version: "0.4.4",
        date: "2026-02-11",
        title: "Démarrage Premium",
        changes: [
            "Splash screen miniature (120x120) pour un chargement discret et élégant",
            "Transition animée prolongée (2s) pour une meilleure expérience utilisateur",
            "Uniformisation du logo dans toute l'application",
            "Gestion intelligente des boutons de fenêtre macOS au démarrage"
        ],
        features: []
    },
    {
        version: "0.4.3",
        date: "2026-02-11",
        title: "Finalisation des icônes",
        changes: [
            "Mise à jour complète de tous les formats d'icônes système (icns, ico, png)",
            "L'icône Gold & Silver est désormais visible dans le Dock et la barre des tâches"
        ],
        features: []
    },
    {
        version: "0.4.2",
        date: "2026-02-11",
        title: "Design Premium & Robustesse",
        changes: [
            "Nouveau logo Or et Argent pour une esthétique haut de gamme",
            "Correction définitive de la restauration des bordures de fenêtre",
            "Amélioration de la fluidité de transition après le splash screen"
        ],
        features: []
    },
    {
        version: "0.4.1",
        date: "2026-02-11",
        title: "Optimisation Turbo du Build",
        changes: [
            "Implémentation de sccache pour une compilation Rust ultra-rapide",
            "Amélioration des clés de cache pour éviter les recompilations inutiles",
            "Optimisation de la gestion des dépendances Bun"
        ],
        features: []
    },
    {
        version: "0.4.0",
        date: "2026-02-11",
        title: "Correctif de l'interface",
        changes: [
            "Correction du problème de barre de titre manquante après le splash screen",
            "Stabilisation de la transition entre le chargement et l'application",
            "Amélioration de la restauration de la position de la fenêtre"
        ],
        features: []
    },
    {
        version: "0.3.9",
        date: "2026-02-10",
        title: "Optimisation de l'infrastructure",
        changes: [
            "Accélération majeure du processus de build multi-plateforme",
            "Mise en cache intelligente des dépendances Rust et Frontend",
            "Réduction du temps d'attente pour les nouvelles releases"
        ],
        features: []
    },
    {
        version: "0.3.8",
        date: "2026-02-10",
        title: "Transition Dynamique",
        changes: [
            "Ajout d'une transition animée entre le splash screen et l'application",
            "Effet de zoom et de fondu fluide au démarrage",
            "Apparition progressive de l'interface principale"
        ],
        features: []
    },
    {
        version: "0.3.7",
        date: "2026-02-10",
        title: "Splash Screen Perfectionné",
        changes: [
            "Le splash screen est désormais un carré parfait sans bordures (borderless)",
            "Ajout de coins arrondis pour un aspect plus moderne au démarrage",
            "Transition améliorée vers l'interface principale"
        ],
        features: []
    },
    {
        version: "0.3.6",
        date: "2026-02-10",
        title: "Identité visuelle rafraîchie",
        changes: [
            "Nouveau logo professionnel au format SVG haute définition",
            "Mise à jour du splash screen avec le nouveau design",
            "Icône plus nette et moderne sur toute l'interface"
        ],
        features: []
    },
    {
        version: "0.3.5",
        date: "2026-02-10",
        title: "Splash Screen optimisé",
        changes: [
            "Le splash screen s'affiche désormais dans une fenêtre carrée centrée",
            "Transition fluide de la fenêtre splash vers la taille normale de l'application",
            "Amélioration visuelle du chargement initial"
        ],
        features: []
    },
    {
        version: "0.3.4",
        date: "2026-02-10",
        title: "Mises à jour intelligentes",
        changes: [
            "Système de mise à jour plus robuste : l'application ne propose plus de mise à jour tant qu'elle n'est pas 100% prête",
            "Amélioration des messages d'erreur lors des vérifications manuelles",
            "Mise à jour en arrière-plan plus discrète"
        ],
        features: []
    },
    {
        version: "0.3.3",
        date: "2026-02-10",
        title: "Nouvel écran de chargement",
        changes: [
            "Ajout d'un écran de chargement (splash screen) au démarrage",
            "Initialisation instantanée de la fenêtre",
            "Transition fluide entre le chargement et l'application"
        ],
        features: []
    },
    {
        version: "0.3.2",
        date: "2026-02-10",
        title: "Lancement fluide et instantané",
        changes: [
            "Suppression du 'flash' blanc/bleu au démarrage : l'application s'affiche désormais directement avec votre thème",
            "Optimisation du processus de chargement pour une meilleure réactivité"
        ],
        features: []
    },
    {
        version: "0.3.1",
        date: "2026-02-10",
        title: "Correctif de stabilité des paramètres",
        changes: [
            "Correction définitive de la perte des paramètres (thème, couleurs) au démarrage",
            "Correction de l'affichage répétitif des nouveautés à chaque lancement",
            "Amélioration de la synchronisation entre la fenêtre et la base de données"
        ],
        features: []
    },
    {
        version: "0.3.0",
        date: "2026-02-10",
        title: "Simplification de l'interface",
        changes: [
            "Regroupement des sections 'À propos' et 'Mises à jour' pour une navigation plus fluide",
            "Optimisation de l'espace dans les paramètres"
        ],
        features: []
    },
    {
        version: "0.2.9",
        date: "2026-02-10",
        title: "Nettoyage des paramètres",
        changes: [
            "Suppression du sélecteur de style manuel (désormais entièrement automatique au build)",
            "Optimisation de la structure des données de configuration"
        ],
        features: []
    },
    {
        version: "0.2.8",
        date: "2026-02-10",
        title: "Correction critique du crash des paramètres",
        changes: [
            "Correction d'un crash dans la page des paramètres (icône manquante)",
            "Optimisation du rendu des graphiques"
        ],
        features: []
    },
    {
        version: "0.2.7",
        date: "2026-02-10",
        title: "Correctif de persistence et d'affichage",
        changes: [
            "Correction de la perte des paramètres utilisateur lors des mises à jour",
            "Synchronisation complète des données entre l'interface et la base de données",
            "Ajout d'un sélecteur de style d'affichage (Moderne / Classique) dans les paramètres",
            "Amélioration de la stabilité de la sauvegarde des préférences"
        ],
        features: [
            {
                title: "Paramètres sauvegardés",
                description: "Vos préférences de thème, couleurs et organisation des comptes sont maintenant conservées durablement.",
                icon: "Settings"
            }
        ]
    },
    {
        version: "0.2.4",
        date: "2026-02-10",
        title: "Amélioration de l'expérience utilisateur",
        changes: [
            "Refonte visuelle des messages d'erreur",
            "Ajout d'explications pédagogiques lors des erreurs",
            "Possibilité de voir les détails techniques des erreurs",
            "Nouvelle liste de catégories par défaut plus complète",
            "Suppression des comptes de test par défaut"
        ],
        features: [
            {
                title: "Gestion des erreurs améliorée",
                description: "Les messages d'erreur sont plus clairs et vous aident à comprendre ce qui ne va pas.",
                icon: "AlertCircle"
            },
            {
                title: "Catégories enrichies",
                description: "Près de 30 catégories sont maintenant disponibles pour classer vos dépenses précisément.",
                icon: "Tag"
            }
        ]
    }
];

export const LATEST_VERSION = "0.5.1";