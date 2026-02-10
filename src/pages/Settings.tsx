import React, { useState, useEffect } from 'react';
import { Moon, Sun, Monitor, Download, Upload, RefreshCw, Sparkles } from 'lucide-react';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { getVersion } from '@tauri-apps/api/app';
import { dbService } from '../services/db';
import { useSettings } from '../context/SettingsContext';
import { useBank } from '../context/BankContext';
import { useUpdater } from '../hooks/useUpdater';
import ImportModal from '../features/import/ImportModal';
import CsvImportModal from '../features/import/CsvImportModal';
import QifImportModal from '../features/import/QifImportModal';
import OfxImportModal from '../features/import/OfxImportModal';
import Button from '../components/ui/Button';
import AlertModal from '../components/ui/AlertModal';
import Card from '../components/ui/Card';
import ReleaseNotesModal from '../components/ui/ReleaseNotesModal';

const SettingsPage: React.FC = () => {
    const { settings, updateTheme, updatePrimaryColor, updateDisplayStyle } = useSettings();
    const { addTransaction } = useBank();
    const { checkUpdate, isChecking, updateAvailable } = useUpdater();
    const [appVersion, setAppVersion] = useState('0.0.0');

    useEffect(() => {
        getVersion().then(setAppVersion).catch(() => setAppVersion('0.2.6'));
    }, []);

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);
    const [isQifImportModalOpen, setIsQifImportModalOpen] = useState(false);
    const [isOfxImportModalOpen, setIsOfxImportModalOpen] = useState(false);
    const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);
    const [importFile, setImportFile] = useState<{ name: string; content: string } | null>(null);
    const [alertState, setAlertState] = useState<{ 
        isOpen: boolean; 
        title: string; 
        message: string; 
        type: 'success' | 'error';
        technicalDetails?: string;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'success',
        technicalDetails: ''
    });

    const handleExportData = async () => {
        try {
            const data = await dbService.exportData();
            const jsonString = JSON.stringify(data, null, 2);
            const encodedData = btoa(unescape(encodeURIComponent(jsonString)));

            const filePath = await save({
                filters: [{ name: 'DMX Money Backup', extensions: ['dmx'] }],
                defaultPath: `dmxmoney_backup_${new Date().toISOString().split('T')[0]}.dmx`
            });

            if (filePath) {
                await writeTextFile(filePath, encodedData);
                setAlertState({ 
                    isOpen: true, 
                    title: 'Export réussi !', 
                    message: 'Vos données ont été exportées avec succès.', 
                    type: 'success' 
                });
            }
        } catch (error) {
            setAlertState({ 
                isOpen: true, 
                title: 'Erreur d\'export', 
                message: 'Une erreur est survenue lors de la création de votre sauvegarde.', 
                type: 'error',
                technicalDetails: error instanceof Error ? error.message : String(error)
            });
        }
    };

    const handleImportClick = async () => {
        try {
            const filePath = await open({
                filters: [{ name: 'Fichiers supportés', extensions: ['dmx', 'json', 'csv', 'qif', 'ofx'] }]
            });

            if (filePath) {
                const content = await readTextFile(filePath as string);
                const fileName = (filePath as string).split(/[/\\]/).pop() || 'backup.dmx';
                setImportFile({ name: fileName, content });

                if (fileName.toLowerCase().endsWith('.csv')) setIsCsvImportModalOpen(true);
                else if (fileName.toLowerCase().endsWith('.qif')) setIsQifImportModalOpen(true);
                else if (fileName.toLowerCase().endsWith('.ofx')) setIsOfxImportModalOpen(true);
                else setIsImportModalOpen(true);
            }
        } catch (error) {
            console.error('File selection failed:', error);
            setAlertState({ 
                isOpen: true, 
                title: 'Erreur de lecture', 
                message: 'Impossible de lire le fichier sélectionné.', 
                type: 'error',
                technicalDetails: error instanceof Error ? error.message : String(error)
            });
        }
    };

    const handleConfirmImport = async (mode: 'replace' | 'merge') => {
        if (!importFile) return;
        try {
            let data;
            try { data = JSON.parse(importFile.content); }
            catch (e) {
                const jsonString = decodeURIComponent(escape(atob(importFile.content)));
                data = JSON.parse(jsonString);
            }
            if (mode === 'merge') await dbService.mergeData(data);
            else await dbService.importData(data);

            setAlertState({ 
                isOpen: true, 
                title: 'Import réussi !', 
                message: 'Vos données ont été restaurées. L\'application va redémarrer.', 
                type: 'success' 
            });
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            setAlertState({ 
                isOpen: true, 
                title: 'Erreur d\'import', 
                message: 'Le fichier de sauvegarde semble invalide ou corrompu.', 
                type: 'error',
                technicalDetails: error instanceof Error ? error.message : String(error)
            });
        } finally {
            setIsImportModalOpen(false);
            setImportFile(null);
        }
    };

    const handleTransactionImport = async (transactions: any[], accountId: string) => {
        try {
            let count = 0;
            for (const tx of transactions) {
                await addTransaction({ ...tx, accountId });
                count++;
            }
            setAlertState({ 
                isOpen: true, 
                title: 'Import réussi !', 
                message: `${count} transactions ont été importées dans votre compte.`, 
                type: 'success' 
            });
        } catch (error) {
            setAlertState({ 
                isOpen: true, 
                title: 'Erreur d\'import', 
                message: 'Certaines transactions n\'ont pas pu être importées.', 
                type: 'error',
                technicalDetails: error instanceof Error ? error.message : String(error)
            });
        } finally {
            setIsCsvImportModalOpen(false);
            setIsQifImportModalOpen(false);
            setIsOfxImportModalOpen(false);
            setImportFile(null);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Paramètres</h2>
                <p className="text-sm text-gray-500 mt-1">Gérez vos préférences et vos données.</p>
            </div>

            {/* Apparence */}
            <Card title="Apparence" subtitle="Personnalisez le look de votre application.">
                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 block">Thème</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: 'light', name: 'Clair', icon: Sun, color: 'text-amber-500' },
                                { id: 'dark', name: 'Sombre', icon: Moon, color: 'text-primary-500' },
                                { id: 'system', name: 'Système', icon: Monitor, color: 'text-gray-500' }
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => updateTheme(t.id as any)}
                                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                                        settings.theme === t.id 
                                        ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-500/10' 
                                        : 'border-gray-100 dark:border-neutral-700 hover:border-gray-200 dark:hover:border-gray-600'
                                    }`}
                                >
                                    <t.icon className={`w-6 h-6 mb-2 ${t.color}`} />
                                    <span className="text-sm font-medium">{t.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 block">Couleur d'accentuation</label>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => updatePrimaryColor('default')}
                                className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                                    settings.primaryColor === 'default' 
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10' 
                                    : 'border-gray-100 dark:border-neutral-700'
                                }`}
                            >
                                Défaut
                            </button>
                            {[
                                '#007AFF', '#AF52DE', '#FF2D55', '#FF3B30', '#FF9500', 
                                '#FFCC00', '#34C759', '#5AC8FA', '#5856D6', '#8E8E93'
                            ].map(color => (
                                <button
                                    key={color}
                                    onClick={() => updatePrimaryColor(color)}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                                        settings.primaryColor === color ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-110'
                                    }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 block">Style d'affichage</label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: 'modern', name: 'Moderne', icon: Sparkles, color: 'text-primary-500' },
                                { id: 'legacy', name: 'Classique', icon: LayoutDashboard, color: 'text-gray-500' }
                            ].map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => updateDisplayStyle(s.id as any)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                                        settings.displayStyle === s.id 
                                        ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-500/10' 
                                        : 'border-gray-100 dark:border-neutral-700 hover:border-gray-200 dark:hover:border-gray-600'
                                    }`}
                                >
                                    <s.icon className={`w-5 h-5 ${s.color}`} />
                                    <span className="text-sm font-medium">{s.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Mises à jour */}
            <Card title="Mises à jour" subtitle="Vérifiez si une nouvelle version est disponible.">
                <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-800/50">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">Version actuelle</div>
                            {updateAvailable && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 animate-pulse">
                                    Nouvelle version dispo
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-gray-500">v{appVersion}</div>
                    </div>
                    <Button 
                        onClick={() => checkUpdate()} 
                        isLoading={isChecking}
                        icon={RefreshCw}
                        variant={updateAvailable ? "primary" : "secondary"}
                    >
                        {updateAvailable ? "Mettre à jour" : "Vérifier"}
                    </Button>
                </div>
            </Card>

            {/* Données */}
            <Card title="Gestion des données" subtitle="Sauvegardez ou restaurez vos informations financières.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-gray-100 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-800/50">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600">
                                <Download className="w-5 h-5" />
                            </div>
                            <span className="font-semibold">Exporter</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">Créez une sauvegarde sécurisée de toutes vos transactions et comptes.</p>
                        <Button variant="secondary" size="sm" fullWidth onClick={handleExportData}>Générer un backup (.dmx)</Button>
                    </div>

                    <div className="p-4 rounded-xl border border-gray-100 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-800/50">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600">
                                <Upload className="w-5 h-5" />
                            </div>
                            <span className="font-semibold">Importer</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">Restaurez un backup ou importez des fichiers CSV/OFX de votre banque.</p>
                        <Button variant="secondary" size="sm" fullWidth onClick={handleImportClick}>Choisir un fichier</Button>
                    </div>
                </div>
            </Card>

            {/* À propos */}
            <Card title="À propos" subtitle="Informations sur l'application.">
                <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-800/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white dark:bg-neutral-900 p-2 border border-gray-100 dark:border-neutral-700">
                            <img src="/vite.svg" alt="DmxMoney Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <div className="font-bold text-gray-900 dark:text-gray-100">DmxMoney</div>
                            <div className="text-xs text-gray-500">Version {appVersion} — Créé avec ❤️</div>
                        </div>
                    </div>
                    <Button 
                        onClick={() => setIsReleaseNotesOpen(true)}
                        variant="secondary"
                        size="sm"
                        icon={Sparkles}
                    >
                        Nouveautés
                    </Button>
                </div>
            </Card>

            <AlertModal
                isOpen={alertState.isOpen}
                onClose={() => setAlertState({ ...alertState, isOpen: false })}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
                technicalDetails={alertState.technicalDetails}
            />
            <ReleaseNotesModal 
                isOpen={isReleaseNotesOpen} 
                onClose={() => setIsReleaseNotesOpen(false)} 
            />
            <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImport={handleConfirmImport} fileName={importFile?.name || ''} />
            <CsvImportModal isOpen={isCsvImportModalOpen} onClose={() => setIsCsvImportModalOpen(false)} file={importFile} onImport={handleTransactionImport} />
            <QifImportModal isOpen={isQifImportModalOpen} onClose={() => setIsQifImportModalOpen(false)} file={importFile} onImport={handleTransactionImport} />
            <OfxImportModal isOpen={isOfxImportModalOpen} onClose={() => setIsOfxImportModalOpen(false)} file={importFile} onImport={handleTransactionImport} />
        </div>
    );
};

export default SettingsPage;