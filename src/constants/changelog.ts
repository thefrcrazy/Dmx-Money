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