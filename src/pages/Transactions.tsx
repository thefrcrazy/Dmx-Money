import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Search, Trash2, Edit2, CheckCircle2, ArrowRightLeft, Tag, Circle, Filter, LayoutGrid, AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import { useBank } from '../context/BankContext';
import { useToast } from '../context/ToastContext';
import FormPopup from '../components/ui/FormPopup';
import ConfirmModal from '../components/ui/ConfirmModal';
import SearchableSelect from '../components/ui/SearchableSelect';
import { Transaction } from '../types';
import { ICONS } from '../constants/icons';
import Table from '../components/ui/Table';
import Input from '../components/ui/Input';
import { useFinancialMetrics } from '../hooks/useFinancialMetrics';
import { formatCurrency, formatDate } from '../utils/format';

const Transactions: React.FC = () => {
    const {
        accounts,
        transactions,
        categories,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        toggleTransactionCheck,
        filterAccount,
        scheduled
    } = useBank();

    const { showToast } = useToast();
    const { relevantTransactions } = useFinancialMetrics();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
    
    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isGroupDeleteModalOpen, setIsGroupDeleteModalOpen] = useState(false);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        type: 'expense' as any,
        categoryId: '',
        accountId: '',
        isTransfer: false
    });

    const displayTransactions = useMemo(() => {
        let filtered = relevantTransactions;
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(t => t.description.toLowerCase().includes(lowerSearch) || t.amount.toString().includes(lowerSearch));
        }
        if (filterCategory !== 'all') {
            filtered = filtered.filter(t => t.category === filterCategory);
        }
        return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [relevantTransactions, searchTerm, filterCategory]);

    const transactionsWithBalance = useMemo(() => {
        const allSorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const accountBalances: Record<string, number> = {};
        accounts.forEach(acc => accountBalances[acc.id] = acc.initialBalance);

        const withBalance = allSorted.map(t => {
            const currentBal = accountBalances[t.accountId] || 0;
            const newBal = currentBal + (t.type === 'income' ? t.amount : -t.amount);
            accountBalances[t.accountId] = newBal;
            return { ...t, balance: newBal };
        });

        const displayIds = new Set(displayTransactions.map(ft => ft.id));
        return withBalance.reverse().filter(t => displayIds.has(t.id));
    }, [transactions, accounts, displayTransactions]);

    const handleOpenModal = (transaction?: Transaction) => {
        if (transaction) {
            setEditingTransaction(transaction);
            setFormData({
                date: transaction.date,
                description: transaction.description,
                amount: transaction.amount.toString(),
                type: transaction.type,
                categoryId: transaction.category,
                accountId: transaction.accountId,
                isTransfer: !!transaction.linkedTransactionId
            });
        } else {
            setEditingTransaction(null);
            setFormData({
                date: new Date().toISOString().split('T')[0],
                description: '',
                amount: '',
                type: 'expense',
                categoryId: '',
                accountId: filterAccount.length === 1 ? filterAccount[0] : accounts[0]?.id || '',
                isTransfer: false
            });
        }
        setIsModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (transactionToDelete) {
            try {
                await deleteTransaction(transactionToDelete);
                showToast("Transaction supprimée", "success");
                setTransactionToDelete(null);
            } catch (e) {
                showToast("Erreur lors de la suppression", "error");
            }
        }
        setIsDeleteModalOpen(false);
    };

    const handleToggleSelect = useCallback((id: string | number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id as string)) next.delete(id as string);
            else next.add(id as string);
            return next;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        if (selectedIds.size === displayTransactions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(displayTransactions.map(t => t.id)));
        }
    }, [selectedIds.size, displayTransactions]);

    const handleGroupDelete = async () => {
        const count = selectedIds.size;
        try {
            await Promise.all(Array.from(selectedIds).map(id => deleteTransaction(id)));
            setSelectedIds(new Set());
            showToast(`${count} transactions supprimées`, "success");
        } catch (e) {
            showToast("Erreur lors de la suppression groupée", "error");
        }
        setIsGroupDeleteModalOpen(false);
    };

    const handleGroupCheck = async () => {
        const count = selectedIds.size;
        try {
            // Determine the next state (if all checked, uncheck all, otherwise check all)
            const selectedTxs = transactions.filter(t => selectedIds.has(t.id));
            const allChecked = selectedTxs.every(t => t.checked);
            
            for (const id of Array.from(selectedIds)) {
                const tx = selectedTxs.find(t => t.id === id);
                if (tx && tx.checked === allChecked) {
                    await toggleTransactionCheck(id);
                }
            }
            showToast(`${count} transactions mises à jour`, "success");
        } catch (e) {
            showToast("Erreur lors de la mise à jour groupée", "error");
        }
    };

    const handleCellUpdate = async (transaction: Transaction, accessor: keyof Transaction, newValue: any) => {
        try {
            let updatedValue = newValue;
            
            // Validation simple
            if (accessor === 'amount') {
                updatedValue = parseFloat(String(newValue).replace(',', '.'));
                if (isNaN(updatedValue)) return;
            }
            
            if (transaction[accessor] === updatedValue) return;

            await updateTransaction({
                ...transaction,
                [accessor]: updatedValue
            });
            showToast("Transaction mise à jour", "success");
        } catch (e) {
            showToast("Erreur lors de la mise à jour", "error");
        }
    };

    const getCategoryDetails = (id: string) => {
        if (id === 'transfer') return { name: 'Virement', color: '#6366f1', icon: 'ArrowRightLeft' };
        return categories.find(c => c.id === id) || { name: 'Inconnu', color: '#9ca3af', icon: 'Tag' };
    };

    const renderCategoryIcon = (iconName: string, className: string = "w-4 h-4") => {
        if (iconName === 'ArrowRightLeft') return <ArrowRightLeft className={className} />;
        const Icon = ICONS[iconName] || Tag;
        return <Icon className={className} />;
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center px-1 flex-none">
                <div className="w-full sm:w-96">
                    <Input 
                        placeholder="Rechercher une description ou un montant..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        icon={Search} 
                    />
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <SearchableSelect 
                        value={filterCategory} 
                        onChange={setFilterCategory} 
                        options={[
                            { id: 'all', label: 'Toutes les catégories', icon: 'Filter' }, 
                            ...categories.map(c => ({ id: c.id, label: c.name, icon: c.icon, color: c.color }))
                        ]} 
                        className="w-56" 
                    />
                    <Button onClick={() => handleOpenModal()} icon={Plus}>Nouvelle</Button>
                </div>
            </div>

            {/* Selection Toolbar */}
            {selectedIds.size > 0 && (
                <div className="bg-primary-500/10 border border-primary-500/20 p-2 px-4 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center gap-4 text-sm font-semibold text-primary-700 dark:text-primary-400">
                        <span>{selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}</span>
                        <div className="h-4 w-px bg-primary-500/30"></div>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleGroupCheck}
                                className="flex items-center gap-1.5 hover:text-primary-800 transition-colors"
                            >
                                <CheckCircle2 className="w-4 h-4" /> Pointer/Dépointer
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setSelectedIds(new Set())}
                            className="text-primary-700 dark:text-primary-400 hover:bg-primary-500/10"
                        >
                            Annuler
                        </Button>
                        <Button 
                            variant="danger" 
                            size="sm" 
                            icon={Trash2}
                            onClick={() => setIsGroupDeleteModalOpen(true)}
                        >
                            Supprimer
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex-1 bg-white dark:bg-[#121212] rounded-xl border border-black/[0.05] dark:border-white/10 shadow-sm overflow-hidden flex flex-col min-h-[calc(100vh-170px)] max-h-[calc(100vh-170px)]">
                <Table
                    data={transactionsWithBalance}
                    keyExtractor={(t) => t.id}
                    selectedIds={selectedIds as any}
                    onSelectRow={handleToggleSelect}
                    onSelectAll={handleSelectAll}
                    isAllSelected={selectedIds.size > 0 && selectedIds.size === displayTransactions.length}
                    onCellUpdate={handleCellUpdate}
                    emptyMessage={
                        <div className="flex flex-col items-center gap-4 py-12 text-center">
                            <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
                                <Search className="w-10 h-10 text-gray-300 dark:text-gray-700" />
                            </div>
                            <div>
                                <p className="text-gray-900 dark:text-gray-100 font-bold text-lg">Aucune transaction</p>
                                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
                                    {searchTerm || filterCategory !== 'all' 
                                        ? "Aucun résultat pour vos filtres actuels." 
                                        : "Commencez par ajouter une transaction ou importez un relevé bancaire."}
                                </p>
                            </div>
                            {!searchTerm && filterCategory === 'all' && (
                                <Button onClick={() => handleOpenModal()} icon={Plus}>Ajouter une transaction</Button>
                            )}
                        </div>
                    }
                    columns={[
                        {
                            header: 'Compte',
                            width: '120px',
                            accessor: 'accountId',
                            truncate: true,
                            render: (t) => {
                                const acc = accounts.find(a => a.id === t.accountId);
                                return (
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 rounded-full flex-none" style={{ backgroundColor: acc?.color || '#eee' }} />
                                        <span className="font-medium truncate">{acc?.name}</span>
                                    </div>
                                );
                            }
                        },
                        {
                            header: 'Date',
                            width: '90px',
                            render: (t) => <span className="text-gray-500">{formatDate(t.date, 'dd MMM')}</span>
                        },
                        {
                            header: 'Catégorie',
                            width: '130px',
                            render: (t) => {
                                const cat = getCategoryDetails(t.category);
                                return (
                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                                        {renderCategoryIcon(cat.icon, "w-3 h-3")}
                                        <span className="truncate">{cat.name}</span>
                                    </div>
                                );
                            }
                        },
                        {
                            header: 'Description',
                            width: '1fr',
                            accessor: 'description',
                            truncate: true,
                            editable: true,
                            render: (t) => <span className="font-medium text-gray-900 dark:text-gray-100">{t.description}</span>
                        },
                        {
                            header: 'Montant',
                            width: '120px',
                            align: 'right',
                            accessor: 'amount',
                            className: "tabular-nums font-bold",
                            editable: true,
                            editType: 'number',
                            render: (t) => (
                                <span className={t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}>
                                    {t.type === 'income' ? '+' : '-'}{new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(t.amount)} €
                                </span>
                            )
                        },
                        {
                            header: 'Budget',
                            width: '80px',
                            align: 'center',
                            render: (t) => {
                                const isBudgeted = scheduled.some(s => s.category === t.category && s.type === 'expense');
                                return isBudgeted ? <span className="text-[10px] font-bold text-indigo-500/70 border border-indigo-500/20 px-1.5 py-0.5 rounded">PRÉVU</span> : null;
                            }
                        },
                        {
                            header: 'État',
                            width: '60px',
                            align: 'center',
                            render: (t) => (
                                <button onClick={() => toggleTransactionCheck(t.id)} className={`transition-colors ${t.checked ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-400'}`}>
                                    {t.checked ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                </button>
                            )
                        },
                        {
                            header: 'Solde',
                            width: '120px',
                            align: 'right',
                            className: "tabular-nums text-gray-400 opacity-60",
                            render: (t) => <span>{formatCurrency((t as any).balance)}</span>
                        },
                        {
                            header: '',
                            width: '80px',
                            align: 'right',
                            render: (t) => (
                                <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="sm" icon={Edit2} onClick={() => handleOpenModal(t)} className="h-8 w-8 p-0" />
                                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { setTransactionToDelete(t.id); setIsDeleteModalOpen(true); }} className="h-8 w-8 p-0 text-red-400 hover:text-red-600" />
                                </div>
                            )
                        }
                    ]}
                />
            </div>

            <FormPopup isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                        const transactionData = {
                            date: formData.date,
                            amount: parseFloat(formData.amount),
                            description: formData.description,
                            category: formData.categoryId,
                            accountId: formData.accountId,
                            type: formData.type as 'income' | 'expense',
                            checked: false
                        };
                        if (editingTransaction) {
                            await updateTransaction({ ...editingTransaction, ...transactionData });
                            showToast("Transaction mise à jour", "success");
                        } else {
                            await addTransaction(transactionData);
                            showToast("Transaction ajoutée", "success");
                        }
                        setIsModalOpen(false);
                    } catch (err) {
                        showToast("Une erreur est survenue", "error");
                    }
                }} className="p-6 space-y-6">
                    <h3 className="text-lg font-semibold">{editingTransaction ? "Modifier" : "Nouvelle"} transaction</h3>
                    <div className="space-y-4">
                        <Input label="Description" required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Montant" type="number" step="0.01" required value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} rightElement="€" />
                            <Input label="Date" type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                        </div>
                        <SearchableSelect label="Catégorie" value={formData.categoryId} onChange={val => setFormData({ ...formData, categoryId: val })} options={categories.map(c => ({ id: c.id, label: c.name, icon: c.icon, color: c.color }))} />
                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="secondary" fullWidth onClick={() => setIsModalOpen(false)}>Annuler</Button>
                            <Button type="submit" fullWidth>Enregistrer</Button>
                        </div>
                    </div>
                </form>
            </FormPopup>

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Supprimer"
                message="Voulez-vous vraiment supprimer cette transaction ?"
                confirmLabel="Supprimer"
                isDangerous
            />

            <ConfirmModal
                isOpen={isGroupDeleteModalOpen}
                onClose={() => setIsGroupDeleteModalOpen(false)}
                onConfirm={handleGroupDelete}
                title="Supprimer la sélection"
                message={`Voulez-vous vraiment supprimer les ${selectedIds.size} transactions sélectionnées ?`}
                confirmLabel="Tout supprimer"
                isDangerous
            />
        </div>
    );
};

export default Transactions;
