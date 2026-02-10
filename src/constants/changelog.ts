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