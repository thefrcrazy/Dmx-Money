import React, { useState, useEffect } from 'react';
import { Moon, Sun, Monitor, Download, Upload, RefreshCw, ChevronRight, Palette, HardDrive, Info } from 'lucide-react';
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
import AlertModal from '../components/ui/AlertModal';
import ReleaseNotesModal from '../components/ui/ReleaseNotesModal';

const SettingsPage: React.FC = () => {
    const { settings, updateTheme, updatePrimaryColor } = useSettings();
    const { addTransaction } = useBank();
    const { checkUpdate, isChecking, updateAvailable } = useUpdater();
    const [appVersion, setAppVersion] = useState<string | null>(null);

    useEffect(() => {
        getVersion().then(setAppVersion).catch(() => setAppVersion(null));
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
                    title: 'Export réussi',
                    message: 'Vos données ont été exportées avec succès.',
                    type: 'success'
                });
            }
        } catch (error) {
            setAlertState({
                isOpen: true,
                title: 'Erreur d\'export',
                message: 'Impossible de créer la sauvegarde.',
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
                message: 'Le fichier n\'a pas pu être lu.',
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
                title: 'Import réussi',
                message: 'Les données ont été restaurées. Redémarrage...',
                type: 'success'
            });
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            setAlertState({
                isOpen: true,
                title: 'Fichier invalide',
                message: 'Le fichier de sauvegarde est corrompu.',
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
            for (const tx of transactions) {
                await addTransaction({ ...tx, accountId });
            }
            setAlertState({
                isOpen: true,
                title: 'Import terminé',
                message: `${transactions.length} transactions importées.`,
                type: 'success'
            });
        } catch (error) {
            setAlertState({
                isOpen: true,
                title: 'Erreur d\'import',
                message: 'Certaines transactions ont échoué.',
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

    const colors = [
        '#007AFF', '#AF52DE', '#FF2D55', '#FF3B30', '#FF9500',
        '#FFCC00', '#34C759', '#5AC8FA', '#5856D6', '#8E8E93'
    ];

    return (
        <div className="max-w-3xl mx-auto pb-20 animate-in fade-in duration-300">
            <header className="mb-10 px-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Paramètres</h1>
            </header>

            <div className="space-y-10">
                {/* SECTION APPARENCE */}
                <section>
                    <div className="flex items-center gap-2 mb-3 px-2">
                        <Palette className="w-4 h-4 text-gray-400" />
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Apparence</h2>
                    </div>
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.05] shadow-sm overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                        
                        {/* Thème */}
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-[15px] font-medium text-gray-900 dark:text-white">Thème de l'interface</h3>
                                <p className="text-[13px] text-gray-500 mt-0.5">Choisissez l'aspect visuel de l'application</p>
                            </div>
                            <div className="flex bg-gray-100 dark:bg-black/50 p-1 rounded-xl">
                                {[
                                    { id: 'light', icon: Sun },
                                    { id: 'dark', icon: Moon },
                                    { id: 'system', icon: Monitor }
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => updateTheme(t.id as any)}
                                        className={`px-4 py-1.5 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                            settings.theme === t.id 
                                            ? 'bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                    >
                                        <t.icon className="w-4 h-4" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Couleurs */}
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-[15px] font-medium text-gray-900 dark:text-white">Couleur d'accentuation</h3>
                                <p className="text-[13px] text-gray-500 mt-0.5">Personnalisez la couleur principale</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => updatePrimaryColor('default')}
                                    className={`w-7 h-7 rounded-full border-2 transition-transform duration-200 flex items-center justify-center text-[10px] font-bold ${
                                        settings.primaryColor === 'default' 
                                        ? 'border-gray-900 dark:border-white scale-110 text-gray-900 dark:text-white' 
                                        : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:scale-110'
                                    }`}
                                >
                                    Def
                                </button>
                                <div className="w-px h-5 bg-gray-200 dark:bg-gray-800 mx-1"></div>
                                {colors.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => updatePrimaryColor(color)}
                                        className={`w-7 h-7 rounded-full border-2 transition-all duration-200 ${
                                            settings.primaryColor === color 
                                            ? 'border-gray-900 dark:border-white scale-110' 
                                            : 'border-transparent hover:scale-110'
                                        }`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECTION DONNÉES */}
                <section>
                    <div className="flex items-center gap-2 mb-3 px-2">
                        <HardDrive className="w-4 h-4 text-gray-400" />
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Données & Stockage</h2>
                    </div>
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.05] shadow-sm overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                        
                        <button 
                            onClick={handleExportData}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#2C2C2E]/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-gray-100 dark:bg-black/50 rounded-lg text-gray-600 dark:text-gray-400">
                                    <Download className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-[15px] font-medium text-gray-900 dark:text-white">Exporter les données</h3>
                                    <p className="text-[13px] text-gray-500 mt-0.5">Créer une sauvegarde sécurisée (.dmx)</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                        </button>

                        <button 
                            onClick={handleImportClick}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#2C2C2E]/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-gray-100 dark:bg-black/50 rounded-lg text-gray-600 dark:text-gray-400">
                                    <Upload className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-[15px] font-medium text-gray-900 dark:text-white">Importer ou Restaurer</h3>
                                    <p className="text-[13px] text-gray-500 mt-0.5">Depuis un backup ou un fichier CSV/OFX/QIF</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                        </button>
                    </div>
                </section>

                {/* SECTION A PROPOS */}
                <section>
                    <div className="flex items-center gap-2 mb-3 px-2">
                        <Info className="w-4 h-4 text-gray-400" />
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">À propos</h2>
                    </div>
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.05] shadow-sm overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                        
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-xl" />
                                <div>
                                    <h3 className="text-[15px] font-medium text-gray-900 dark:text-white">DmxMoney</h3>
                                    <p className="text-[13px] text-gray-500 mt-0.5">{appVersion ? `Version ${appVersion}` : 'Version indisponible'}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsReleaseNotesOpen(true)}
                                className="text-[13px] font-medium text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 bg-primary-50 dark:bg-primary-500/10 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                Nouveautés
                            </button>
                        </div>

                        <div className="p-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-[15px] font-medium text-gray-900 dark:text-white">Mise à jour logicielle</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[13px] text-gray-500">
                                        {updateAvailable ? "Nouvelle version disponible" : "L'application est à jour"}
                                    </span>
                                    {updateAvailable && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                                </div>
                            </div>
                            <button
                                onClick={() => checkUpdate()}
                                disabled={isChecking}
                                className={`flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-xl transition-all ${
                                    updateAvailable 
                                    ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-sm' 
                                    : 'bg-gray-100 dark:bg-black/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-black/70'
                                }`}
                            >
                                <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                                {updateAvailable ? "Installer" : "Vérifier"}
                            </button>
                        </div>
                    </div>
                </section>
            </div>

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
