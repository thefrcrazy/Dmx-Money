
import React, { useState, useMemo } from 'react';
import { Plus, Calendar, Trash2, Edit2, Clock, X, Tag } from 'lucide-react';
import Button from '../components/ui/Button';
import { useBank } from '../context/BankContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import FormPopup from '../components/ui/FormPopup';
import ConfirmModal from '../components/ui/ConfirmModal';
import SearchableSelect, { SelectOption } from '../components/ui/SearchableSelect';
import { ScheduledTransaction, TransactionType, Periodicity } from '../types';
import { ICONS } from '../constants/icons';
import Table from '../components/ui/Table';
import Input from '../components/ui/Input';

const Scheduled: React.FC = () => {
    const { accounts, scheduled, categories, addScheduled, updateScheduled, deleteScheduled, filterAccount } = useBank();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<ScheduledTransaction | null>(null);

    const scheduledTransactions = useMemo(() => {
        const filtered = filterAccount.length === 0
            ? scheduled
            : scheduled.filter(t => filterAccount.includes(t.accountId));
        return [...filtered].sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime());
    }, [scheduled, filterAccount]);

    // Delete Confirmation State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        type: 'expense' as TransactionType,
        categoryId: '',
        accountId: '',
        toAccountId: '',
        frequency: 'monthly' as Periodicity,
        nextDate: new Date().toISOString().split('T')[0],
        includeInForecast: false,
        endDate: ''
    });

    const handleOpenModal = (transaction?: ScheduledTransaction) => {
        if (transaction) {
            setEditingTransaction(transaction);
            setFormData({
                description: transaction.description,
                amount: transaction.amount.toString(),
                type: transaction.type,
                categoryId: transaction.category,
                accountId: transaction.accountId,
                toAccountId: transaction.toAccountId || '',
                frequency: transaction.frequency,
                nextDate: transaction.nextDate,
                includeInForecast: transaction.includeInForecast ?? false,
                endDate: transaction.endDate || ''
            });
        } else {
            setEditingTransaction(null);
            setFormData({
                description: '',
                amount: '',
                type: 'expense',
                categoryId: '',
                accountId: accounts[0]?.id || '',
                toAccountId: '',
                frequency: 'monthly',
                nextDate: new Date().toISOString().split('T')[0],
                includeInForecast: false,
                endDate: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const transactionData = {
            description: formData.description,
            amount: parseFloat(formData.amount),
            type: formData.type,
            category: formData.type === 'transfer' ? 'transfer' : formData.categoryId,
            accountId: formData.accountId,
            toAccountId: formData.toAccountId || undefined,
            frequency: formData.frequency,
            nextDate: formData.nextDate,
            includeInForecast: formData.includeInForecast,
            endDate: formData.endDate || undefined
        };

        if (editingTransaction) {
            updateScheduled({ ...transactionData, id: editingTransaction.id });
        } else {
            addScheduled(transactionData);
        }
        setIsModalOpen(false);
    };

    const handleDeleteClick = (id: string) => {
        setTransactionToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (transactionToDelete) {
            deleteScheduled(transactionToDelete);
            setTransactionToDelete(null);
        }
        setIsDeleteModalOpen(false);
    };

    const getCategoryDetails = (id: string) => {
        const cat = categories.find(c => c.id === id);
        return cat || { name: 'Inconnu', color: '#9ca3af', icon: 'Tag' };
    };

    const renderCategoryIcon = (iconName: string, className: string = "w-4 h-4") => {
        const Icon = ICONS[iconName] || Tag;
        return <Icon className={className} />;
    };

    const categoryOptions: SelectOption[] = categories.map(c => ({
        id: c.id,
        label: c.name,
        icon: c.icon,
        color: c.color
    }));

    return (
        <div className="flex flex-col space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-200">Transactions Récurrentes</h2>
                <Button
                    onClick={() => handleOpenModal()}
                    icon={Plus}
                >
                    Nouvelle transaction
                </Button>
            </div>

            <div className="flex-1 bg-white dark:bg-[#121212] rounded-xl border border-black/[0.05] dark:border-white/10 shadow-sm overflow-hidden flex flex-col min-h-[calc(100vh-170px)] max-h-[calc(100vh-170px)]">
                <Table
                    data={scheduledTransactions}
                    keyExtractor={(t) => t.id}
                    emptyMessage="Aucune transaction récurrente configurée"
                    columns={[
                        {
                            header: 'Compte',
                            render: (transaction) => {
                                const account = accounts.find(a => a.id === transaction.accountId);
                                const isEnded = transaction.endDate && new Date(transaction.endDate) < new Date();
                                return (
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className={`w-1 h-6 rounded-full flex-none ${isEnded ? 'bg-red-500' : ''}`}
                                            style={{ backgroundColor: isEnded ? '#ef4444' : (account?.color || '#3b82f6') }}
                                        />
                                        <span className="font-medium truncate">{account?.name}</span>
                                    </div>
                                );
                            },
                            className: "text-gray-900 dark:text-gray-200 group-[.retro]:text-black"
                        },
                        {
                            header: 'ÉCHÉANCE',
                            render: (transaction) => (
                                <>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 flex-none" />
                                        <span className="truncate">
                                            {format(new Date(transaction.nextDate), 'dd MMM yyyy', { locale: fr })}
                                        </span>
                                        {transaction.endDate && (
                                            <span className="text-xs text-gray-400 ml-1 truncate">
                                                → {format(new Date(transaction.endDate), 'dd MMM yyyy', { locale: fr })}
                                            </span>
                                        )}
                                    </div>
                                    {transaction.includeInForecast && (!transaction.endDate || new Date(transaction.endDate) >= new Date()) && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mt-1">
                                            Prévu
                                        </span>
                                    )}
                                    {transaction.endDate && new Date(transaction.endDate) < new Date() && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 mt-1">
                                            Terminé
                                        </span>
                                    )}
                                </>
                            ),
                            className: "text-gray-500 dark:text-gray-400 group-[.retro]:text-black whitespace-nowrap",
                            truncate: true
                        },
                        {
                            header: 'Fréquence',
                            render: (transaction) => (
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500 group-[.retro]:text-black" />
                                    {(() => {
                                        const labels: Record<string, string> = {
                                            'once': 'Une seule fois',
                                            'daily': 'Journalier',
                                            'weekly': 'Hebdomadaire',
                                            'biweekly': 'Toutes les 2 semaines',
                                            'bimonthly': 'Bimensuel',
                                            'fourweekly': 'Toutes les 4 semaines',
                                            'monthly': 'Mensuel',
                                            'bimestrial': 'Bimestriel',
                                            'quarterly': 'Trimestriel',
                                            'fourmonthly': 'Tous les 4 mois',
                                            'semiannual': 'Semestriel',
                                            'annual': 'Annuel',
                                            'biennial': 'Bisannuel'
                                        };
                                        return labels[transaction.frequency] || transaction.frequency;
                                    })()}
                                </div>
                            ),
                            className: "text-gray-500 dark:text-gray-400 group-[.retro]:text-black whitespace-nowrap"
                        },
                        {
                            header: 'Catégorie',
                            render: (transaction) => {
                                const category = getCategoryDetails(transaction.category);
                                return transaction.type === 'transfer' ? (
                                    <div
                                        className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium group-[.retro]:bg-transparent group-[.retro]:text-black group-[.retro]:border group-[.retro]:border-black group-[.retro]:rounded-none"
                                        style={{ backgroundColor: '#6366f120', color: '#6366f1' }}
                                    >
                                        {renderCategoryIcon('ArrowRightLeft', "w-3 h-3")}
                                        Virement
                                    </div>
                                ) : (
                                    <div
                                        className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium group-[.retro]:bg-transparent group-[.retro]:text-black group-[.retro]:border group-[.retro]:border-black group-[.retro]:rounded-none"
                                        style={{ backgroundColor: `${category.color}20`, color: category.color }}
                                    >
                                        {renderCategoryIcon(category.icon, "w-3 h-3")}
                                        {category.name}
                                    </div>
                                );
                            },
                            className: "whitespace-nowrap"
                        },
                        {
                            header: 'Description',
                            render: (transaction) => (
                                <div className="flex flex-col">
                                    <span>{transaction.description}</span>
                                    {(transaction.includeInForecast === true) && (
                                        <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                            <Tag className="w-3 h-3" />
                                            Prévu
                                        </span>
                                    )}
                                </div>
                            ),
                            className: "text-gray-900 dark:text-gray-200 group-[.retro]:text-black"
                        },
                        {
                            header: 'Montant',
                            align: 'right',
                            render: (transaction) => (
                                <span className={`text-sm font-medium ${transaction.type === 'income' ? 'text-emerald-600' :
                                    transaction.type === 'transfer' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600'
                                    } group-[.retro]:text-black`}>
                                    {transaction.type === 'income' ? '+' : transaction.type === 'transfer' ? '' : '-'}{new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(transaction.amount)} €
                                </span>
                            ),
                            className: "whitespace-nowrap"
                        },
                        {
                            header: 'Actions',
                            align: 'right',
                            render: (transaction) => (
                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleOpenModal(transaction)}
                                        className="text-primary-600 hover:text-primary-900 hover:bg-primary-50 dark:text-primary-400 dark:hover:text-primary-300 dark:hover:bg-primary-900/20"
                                        icon={Edit2}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteClick(transaction.id)}
                                        className="text-red-600 hover:text-red-900 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                                        icon={Trash2}
                                    />
                                </div>
                            ),
                            className: "whitespace-nowrap"
                        }
                    ]}
                    rowClassName={(transaction) => {
                        const isEnded = transaction.endDate && new Date(transaction.endDate) < new Date();
                        return isEnded ? 'bg-red-5 dark:bg-red-900/10' : '';
                    }}
                />
            </div>

            <FormPopup
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            >
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200">{editingTransaction ? "Modifier la transaction" : "Nouvelle transaction récurrente"}</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date de début</label>
                                <Input
                                    type="date"
                                    required
                                    value={formData.nextDate}
                                    onChange={e => setFormData({ ...formData, nextDate: e.target.value })}
                                    className="focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date de fin (optionnel)</label>
                                <div className="relative">
                                    <Input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                        min={formData.nextDate}
                                        className="focus:ring-primary-500 focus:border-primary-500"
                                    />
                                    {formData.endDate && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, endDate: '' })}
                                            className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                            title="Effacer la date de fin"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fréquence</label>
                            <SearchableSelect
                                value={formData.frequency}
                                onChange={(value) => setFormData({ ...formData, frequency: value as Periodicity })}
                                options={[
                                    { id: 'once', label: 'Une seule fois', icon: 'Clock' },
                                    { id: 'daily', label: 'Journalière', icon: 'Clock' },
                                    { id: 'weekly', label: 'Hebdomadaire', icon: 'Clock' },
                                    { id: 'biweekly', label: 'Toutes les 2 semaines', icon: 'Clock' },
                                    { id: 'bimonthly', label: 'Bimensuelle (2x/mois)', icon: 'Clock' },
                                    { id: 'fourweekly', label: 'Toutes les 4 semaines', icon: 'Clock' },
                                    { id: 'monthly', label: 'Mensuelle', icon: 'Clock' },
                                    { id: 'bimestrial', label: 'Bimestrielle (tous les 2 mois)', icon: 'Clock' },
                                    { id: 'quarterly', label: 'Trimestrielle (tous les 3 mois)', icon: 'Clock' },
                                    { id: 'fourmonthly', label: 'Quadrimestrielle (tous les 4 mois)', icon: 'Clock' },
                                    { id: 'semiannual', label: 'Semestrielle (tous les 6 mois)', icon: 'Clock' },
                                    { id: 'annual', label: 'Annuelle', icon: 'Clock' },
                                    { id: 'biennial', label: 'Biennale (tous les 2 ans)', icon: 'Clock' }
                                ]}
                                placeholder="Sélectionner une fréquence"
                                size="md"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                            <Input
                                type="text"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="focus:ring-primary-500 focus:border-primary-500"
                                placeholder="Ex: Loyer"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Montant</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    placeholder="0.00"
                                    rightElement="€"
                                    className="focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                                <SearchableSelect
                                    value={formData.type}
                                    onChange={(value) => setFormData({ ...formData, type: value as TransactionType })}
                                    options={[
                                        { id: 'expense', label: 'Dépense', icon: 'TrendingDown', color: '#ef4444' },
                                        { id: 'income', label: 'Revenu', icon: 'TrendingUp', color: '#10b981' },
                                        { id: 'transfer', label: 'Virement', icon: 'ArrowRightLeft', color: '#6366f1' }
                                    ]}
                                    placeholder="Sélectionner un type"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {formData.type === 'transfer' ? 'Compte source' : 'Compte'}
                                </label>
                                <SearchableSelect
                                    value={formData.accountId}
                                    onChange={(value) => setFormData({ ...formData, accountId: value })}
                                    options={accounts.map(acc => ({
                                        id: acc.id,
                                        label: acc.name,
                                        icon: acc.icon || 'Wallet',
                                        color: acc.color
                                    }))}
                                    placeholder="Sélectionner un compte"
                                />
                            </div>
                            <div>
                                {formData.type === 'transfer' ? (
                                    <>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Compte destination</label>
                                        <SearchableSelect
                                            value={formData.toAccountId || ''}
                                            onChange={(value) => setFormData({ ...formData, toAccountId: value })}
                                            options={accounts
                                                .filter(acc => acc.id !== formData.accountId)
                                                .map(acc => ({
                                                    id: acc.id,
                                                    label: acc.name,
                                                    icon: acc.icon || 'Wallet',
                                                    color: acc.color
                                                }))}
                                            placeholder="Sélectionner un compte"
                                        />
                                    </>
                                ) : (
                                    <>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catégorie</label>
                                        <SearchableSelect
                                            value={formData.categoryId}
                                            onChange={(value) => setFormData({ ...formData, categoryId: value })}
                                            options={categoryOptions}
                                            placeholder="Sélectionner une catégorie"
                                        />
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="includeInForecast"
                                checked={formData.includeInForecast}
                                onChange={e => setFormData({ ...formData, includeInForecast: e.target.checked })}
                                className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                            />
                            <label htmlFor="includeInForecast" className="text-sm text-gray-700 dark:text-gray-300">
                                Inclure dans le "Budget" du mois
                            </label>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1"
                            >
                                Annuler
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1"
                            >
                                {editingTransaction ? 'Modifier' : 'Ajouter'}
                            </Button>
                        </div>
                    </div>
                </form>
            </FormPopup>

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Supprimer la transaction récurrente"
                message="Êtes-vous sûr de vouloir supprimer cette transaction récurrente ?"
                confirmLabel="Supprimer"
                isDangerous={true}
            />
        </div >
    );
};

export default Scheduled;
