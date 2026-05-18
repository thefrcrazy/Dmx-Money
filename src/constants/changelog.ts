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
        version: "1.0.2",
        date: "2026-05-18",
        title: "Correctif updater Windows & Catalina",
        changes: [
            "Remplacement du flux de mise à jour Windows par un installateur NSIS signé directement, sans archive MSI zip à extraire.",
            "Séparation plus stricte des builds macOS : build modern conservé pour Apple Silicon et build legacy-only pour Intel/Catalina.",
            "Correction du risque d'écran de chargement infini lors du démarrage si les paramètres locaux ne répondent pas.",
            "Centralisation de l'état de mise à jour pour éviter les vérifications concurrentes dans l'interface.",
            "Nettoyage des versions affichées en dur : l'interface lit maintenant la version exposée par Tauri."
        ],
        features: [
            {
                title: "Mises à jour Windows fiabilisées",
                description: "Le nouvel artefact de mise à jour évite le chemin fragile de décompression du fichier MSI zip.",
                icon: "RefreshCw"
            },
            {
                title: "Compatibilité Mac préservée",
                description: "Les Mac Apple Silicon gardent le build modern, tandis que les anciens Mac Intel utilisent le build legacy.",
                icon: "Monitor"
            }
        ]
    },
    {
        version: "1.0.1",
        date: "2026-05-15",
        title: "UX/UI et Refonte des Paramètres",
        changes: [
            "Refonte complète de la page Paramètres avec un design natif iOS/macOS (Inset Grouped Lists).",
            "Mise à jour des couleurs et contrôles pour la sélection des thèmes et des couleurs d'accentuation.",
            "Ajout de micro-animations fluides dans l'interface de paramétrage."
        ],
        features: [
            {
                title: "Paramètres Premium",
                description: "Une toute nouvelle page de paramètres, aérée, épurée et très réactive, pensée comme une interface macOS native.",
                icon: "Settings"
            }
        ]
    },
    {
        version: "1.0.0",
        date: "2026-05-15",
        title: "Version 1.0 — Budget, Échéancier et Prévisions",
        changes: [
            "Refonte complète de la page Budget avec budgets indépendants, suivi par catégorie, détails minimalistes et intégration des échéances liées.",
            "Ajout de suggestions de budget et d'échéancier basées sur les opérations récurrentes du Journal, avec ajout et suppression des suggestions.",
            "Amélioration du Journal : tri stable des transactions à date identique, recherche sur toutes les colonnes, filtres multi-catégories et affichage du budget restant.",
            "Évolution de l'Échéancier : liaison explicite à un budget configuré, filtres améliorés et meilleure cohérence des formulaires.",
            "Ajout du scroll virtuel sur les tableaux pour améliorer les performances avec de gros volumes de données.",
            "Amélioration des pages Analyses et Prédictions avec filtre 2 mois, mémorisation des périodes, option de démarrage au 1er du mois et affichage journalier cohérent.",
            "Ajout d'un seuil d'alerte configurable dans Prédictions, avec alertes orange pour le seuil personnalisé et rouge pour les soldes négatifs.",
            "Uniformisation des boutons, des filtres et des états visuels sur les pages principales.",
            "Amélioration de l'intégration macOS : position des traffic lights, sidebar réduite, chevron, tooltips et titres de groupes.",
            "Mises à jour backend et base de données pour supporter les budgets autonomes, les liaisons budget-échéance et les nouveaux états de l'application."
        ],
        features: [
            {
                title: "Budget exploitable",
                description: "Les budgets peuvent maintenant vivre seuls ou être liés à des échéances, avec un suivi clair du prévu, dépensé et restant.",
                icon: "Target"
            },
            {
                title: "Prévisions plus lisibles",
                description: "Les projections affichent les jours, les seuils configurables et les alertes visuelles sans confondre seuil personnalisé et solde négatif.",
                icon: "TrendingUp"
            },
            {
                title: "Interface stabilisée",
                description: "Les tableaux, filtres, boutons et la sidebar macOS ont été harmonisés pour une utilisation plus fluide au quotidien.",
                icon: "Settings"
            }
        ]
    },
    {
        version: "0.7.3",
        date: "2026-03-11",
        title: "Correctif d'urgence (Données invisibles)",
        changes: [
            "Correction d'un problème critique où l'application pointait vers un mauvais dossier de données suite à la mise à jour 0.7.2.",
            "Vos données n'ont pas été supprimées ! Cette mise à jour rétablit simplement le lien vers votre base de données existante."
        ],
        features: [
            {
                title: "Restauration des données",
                description: "Correction de l'identifiant de l'application permettant de retrouver l'accès à vos comptes et transactions.",
                icon: "AlertCircle"
            }
        ]
    },
    {
        version: "0.7.2",
        date: "2026-03-11",
        title: "Transactions & Transferts",
        changes: [
            "Ajout du support complet des virements entre comptes depuis le Journal",
            "Nouveau sélecteur de type de transaction (Dépense, Revenu, Virement) dans le Journal",
            "Amélioration du formulaire d'ajout manuel avec sélection du compte source/destination",
            "Harmonisation de l'interface de saisie entre l'Échéancier et le Journal"
        ],
        features: [
            {
                title: "Virements facilités",
                description: "Gérez directement les virements entre vos différents comptes depuis la page Journal avec création automatique des deux transactions liées.",
                icon: "ArrowRightLeft"
            }
        ]
    },
    {
        version: "0.7.1",
        date: "2026-02-12",
        title: "Configuration & Identité",
        changes: [
            "Officialisation du nom de projet 'dmxmoney'",
            "Mise à jour des fichiers de configuration internes",
            "Nettoyage des références à l'ancien nom de code"
        ],
        features: []
    },
    {
        version: "0.7.0",
        date: "2026-02-11",
        title: "Saisie Intelligente & Calendrier",
        changes: [
            "Nouveau masque de saisie intelligent pour les dates (JJ/MM/AAAA) avec gestion du curseur",
            "Support complet de la saisie manuelle au clavier en plus du sélecteur",
            "Remplacement de Flatpickr par un calendrier natif optimisé pour la performance",
            "Restoration du design des bordures arrondies sur les modales",
            "Correction des couleurs de fond en mode compatibilité (Legacy)"
        ],
        features: []
    },
    {
        version: "0.5.6",
        date: "2026-02-11",
        title: "Correctif Windows & Styles",
        changes: [
            "Correction critique du système de mise à jour sur Windows (support 7z)",
            "Ajustements mineurs des styles globaux et des inputs",
            "Amélioration de la stabilité du calendrier sur les anciens navigateurs"
        ],
        features: []
    },
    {
        version: "0.5.5",
        date: "2026-02-11",
        title: "Identité visuelle & Nettoyage",
        changes: [
            "Mise à jour complète des icônes d'application pour toutes les plateformes (Windows, macOS, Android, iOS)",
            "Amélioration de la résolution du logo et nettoyage des ressources obsolètes",
            "Optimisation de la structure du projet et des types Vite",
            "Ajustements mineurs de l'interface utilisateur pour une meilleure cohérence"
        ],
        features: []
    },
    {
        version: "0.5.4",
        date: "2026-02-11",
        title: "Compatibilité Ultime & Calendrier",
        changes: [
            "Intégration de Flatpickr pour un calendrier fonctionnel sur tous les systèmes",
            "Correction du rendu des couleurs sur Safari 13 (Catalina) via syntaxe RGB legacy",
            "Saisies de dates désormais en format français (JJ/MM/AAAA)",
            "Sécurisation des fonctions de formatage pour les anciens moteurs JavaScript"
        ],
        features: []
    },
    {
        version: "0.5.3",
        date: "2026-02-11",
        title: "Correction Thème & Calendrier",
        changes: [
            "Correction du mode sombre et des couleurs personnalisées en mode Legacy",
            "Amélioration de la saisie des dates sur les anciens systèmes (macOS Catalina)",
            "Correction du centrage du logo sur l'écran de chargement",
            "Optimisation de la stabilité des variables CSS pour toutes les versions de Tailwind"
        ],
        features: []
    },
    {
        version: "0.5.2",
        date: "2026-02-11",
        title: "Compatibilité Intel & Tailwind Fix",
        changes: [
            "Correction majeure du build Intel (x64) pour macOS Catalina",
            "Force l'utilisation du mode Legacy pour les anciens systèmes Mac",
            "Synchronisation des configurations Vite pour éviter les écrasements de paramètres",
            "Mise à jour du pipeline de déploiement automatique"
        ],
        features: []
    },
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
        date: "2026-02-11",
        title: "Splash Screen & Interface",
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

export const LATEST_VERSION = CHANGELOG[0].version;
