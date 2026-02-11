import React from 'react';
import { Sparkles, Check, ChevronRight, X } from 'lucide-react';
import { CHANGELOG, VersionUpdate } from '../../constants/changelog';
import { ICONS } from '../../constants/icons';
import Button from './Button';

interface ReleaseNotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    versionData?: VersionUpdate;
}

const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({
    isOpen,
    onClose,
    versionData = CHANGELOG[0]
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="app-card w-full max-w-lg overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-300 flex flex-col max-h-[90vh]">
                {/* Header avec dégradé */}
                <div className="relative h-32 bg-gradient-to-br from-primary-600 to-indigo-700 p-6 flex items-end">
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1 rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Quoi de neuf ?</h2>
                            <p className="text-primary-100 text-sm">Version {versionData.version} — {versionData.date}</p>
                        </div>
                    </div>
                </div>

                {/* Contenu scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {/* Titre de la version */}
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                            {versionData.title}
                        </h3>
                    </div>

                    {/* Features mises en avant */}
                    {versionData.features && versionData.features.length > 0 && (
                        <div className="grid grid-cols-1 gap-4">
                            {versionData.features.map((feature, idx) => {
                                const IconComp = ICONS[feature.icon] || Sparkles;
                                return (
                                    <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100/50 dark:border-primary-800/30">
                                        <div className="shrink-0 w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-800 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                            <IconComp className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-gray-100">{feature.title}</h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                                {feature.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Liste complète des changements */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Toutes les améliorations</h4>
                        <div className="space-y-3">
                            {versionData.changes.map((change, idx) => (
                                <div key={idx} className="flex items-start gap-3 group">
                                    <div className="mt-1 flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 shrink-0">
                                        <Check className="w-3 h-3" />
                                    </div>
                                    <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                                        {change}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-black/[0.05] dark:border-white/10">
                    <Button 
                        onClick={onClose}
                        fullWidth
                        size="lg"
                        icon={ChevronRight}
                    >
                        C'est parti !
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ReleaseNotesModal;