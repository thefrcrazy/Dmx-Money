import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Account, Transaction, Category, ScheduledTransaction, BankContextType, AppData } from '../types';
import { dbService } from '../services/db';

const BankContext = createContext<BankContextType | undefined>(undefined);

const DEFAULT_DATA: AppData = {
    accounts: [],
    transactions: [],
    categories: [
        // Logement
        { id: '1', name: 'Loyer / Prêt', icon: 'Home', color: '#1e3a8a' },
        { id: '2', name: 'Charges / Énergie', icon: 'Zap', color: '#f59e0b' },
        { id: '3', name: 'Eau', icon: 'Droplets', color: '#0ea5e9' },
        { id: '4', name: 'Assurance Habitation', icon: 'Shield', color: '#4b5563' },
        
        // Vie Quotidienne
        { id: '5', name: 'Alimentation', icon: 'ShoppingBag', color: '#ef4444' },
        { id: '6', name: 'Restaurants / Cafés', icon: 'Utensils', color: '#ea580c' },
        { id: '7', name: 'Shopping / Vêtements', icon: 'Tag', color: '#ec4899' },
        { id: '8', name: 'Hygiène / Beauté', icon: 'Smile', color: '#f472b6' },
        
        // Transport
        { id: '9', name: 'Carburant', icon: 'Fuel', color: '#b45309' },
        { id: '10', name: 'Transport en commun', icon: 'Bus', color: '#d97706' },
        { id: '11', name: 'Entretien Voiture', icon: 'Hammer', color: '#6b7280' },
        { id: '12', name: 'Parking / Péage', icon: 'MapPin', color: '#4b5563' },
        
        // Santé
        { id: '13', name: 'Médecin / Santé', icon: 'Heart', color: '#dc2626' },
        { id: '14', name: 'Pharmacie', icon: 'Pill', color: '#f87171' },
        
        // Loisirs & Culture
        { id: '15', name: 'Loisirs / Cinéma', icon: 'Gamepad2', color: '#8b5cf6' },
        { id: '16', name: 'Abonnements (VOD/Musique)', icon: 'Tv', color: '#6366f1' },
        { id: '17', name: 'Sport / Bien-être', icon: 'Dumbbell', color: '#06b6d4' },
        { id: '18', name: 'Voyages / Vacances', icon: 'Plane', color: '#2563eb' },
        
        // Technologie
        { id: '19', name: 'Téléphonie / Internet', icon: 'Wifi', color: '#3b82f6' },
        { id: '20', name: 'High-Tech / Logiciels', icon: 'Monitor', color: '#1e40af' },
        
        // Revenus
        { id: '21', name: 'Salaire', icon: 'Banknote', color: '#16a34a' },
        { id: '22', name: 'Primes / Bonus', icon: 'Award', color: '#d9f99d' },
        { id: '23', name: 'Cadeaux reçus', icon: 'Gift', color: '#db2777' },
        { id: '24', name: 'Remboursements', icon: 'TrendingUp', color: '#4ade80' },
        
        // Autre
        { id: '25', name: 'Cadeaux offerts', icon: 'Gift', color: '#fca5a5' },
        { id: '26', name: 'Frais Bancaires', icon: 'Landmark', color: '#1f2937' },
        { id: '27', name: 'Impôts / Taxes', icon: 'Briefcase', color: '#7c2d12' },
        { id: '28', name: 'Divers', icon: 'MoreHorizontal', color: '#6b7280' },
        
        { id: 'transfer', name: 'Virement', icon: 'ArrowRightLeft', color: '#6366f1' }
    ],
    scheduled: []
};

export const BankProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [scheduled, setScheduled] = useState<ScheduledTransaction[]>([]);
    const [filterAccount, setFilterAccount] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize DB and load data
    useEffect(() => {
        const init = async () => {
            try {
                await dbService.init();
                const [loadedAccounts, loadedTransactions, loadedCategories, loadedScheduled] = await Promise.all([
                    dbService.getAccounts(),
                    dbService.getTransactions(),
                    dbService.getCategories(),
                    dbService.getScheduled()
                ]);

                let currentAccounts = loadedAccounts;
                let currentTransactions = loadedTransactions;
                let currentCategories = loadedCategories;
                let currentScheduled = loadedScheduled;

                if (loadedAccounts.length === 0 && loadedTransactions.length === 0 && loadedCategories.length === 0 && loadedScheduled.length === 0) {
                    // If no data loaded, use default data and save it
                    currentAccounts = DEFAULT_DATA.accounts;
                    currentTransactions = DEFAULT_DATA.transactions;
                    currentCategories = DEFAULT_DATA.categories;
                    currentScheduled = DEFAULT_DATA.scheduled;

                    await Promise.all([
                        ...DEFAULT_DATA.accounts.map(acc => dbService.addAccount(acc)),
                        ...DEFAULT_DATA.categories.map(cat => dbService.addCategory(cat))
                    ]);
                } else {
                    // Check if 'transfer' category exists, if not add it (migration)
                    const transferExists = currentCategories.some(c => c.id === 'transfer');
                    if (!transferExists) {
                        const transferCategory = { id: 'transfer', name: 'Virement', icon: 'ArrowRightLeft', color: '#6366f1' };
                        await dbService.addCategory(transferCategory);
                        currentCategories = [...currentCategories, transferCategory];
                    }
                }

                // Process scheduled transactions
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const processedScheduled = [...currentScheduled];
                const newTransactions: Transaction[] = [];

                for (let i = 0; i < processedScheduled.length; i++) {
                    const scheduledTx = processedScheduled[i];
                    let nextDate = new Date(scheduledTx.nextDate);
                    nextDate.setHours(0, 0, 0, 0);

                    let modified = false;

                    while (nextDate <= today) {
                        modified = true;

                        // Create transaction(s)
                        // Check if we passed the end date
                        if (scheduledTx.endDate) {
                            const endDate = new Date(scheduledTx.endDate);
                            endDate.setHours(0, 0, 0, 0);
                            if (nextDate > endDate) {
                                // Stop generating and don't update nextDate anymore (or maybe we should to keep it "done")
                                // Actually, if we are here, it means nextDate <= today, so we should generate IF it is <= endDate
                                // If nextDate > endDate, we should stop.
                                break;
                            }
                        }

                        const txId = uuidv4();

                        if (scheduledTx.type === 'transfer' && scheduledTx.toAccountId) {
                            // Transfer: Create two linked transactions
                            const linkedId = uuidv4();

                            // Outgoing transaction (Expense from source)
                            const sourceTx: Transaction = {
                                id: txId,
                                date: scheduledTx.nextDate,
                                accountId: scheduledTx.accountId,
                                type: 'expense',
                                amount: scheduledTx.amount,
                                category: 'transfer',
                                description: scheduledTx.description,
                                checked: false,
                                isTransfer: true,
                                linkedTransactionId: linkedId
                            };

                            // Incoming transaction (Income to destination)
                            const destTx: Transaction = {
                                id: linkedId,
                                date: scheduledTx.nextDate,
                                accountId: scheduledTx.toAccountId,
                                type: 'income',
                                amount: scheduledTx.amount,
                                category: 'transfer',
                                description: scheduledTx.description,
                                checked: false,
                                isTransfer: true,
                                linkedTransactionId: txId
                            };

                            newTransactions.push(sourceTx, destTx);
                            await Promise.all([
                                dbService.addTransaction(sourceTx),
                                dbService.addTransaction(destTx)
                            ]);
                        } else {
                            // Standard transaction
                            const newTx: Transaction = {
                                id: txId,
                                date: scheduledTx.nextDate,
                                accountId: scheduledTx.accountId,
                                type: scheduledTx.type,
                                amount: scheduledTx.amount,
                                category: scheduledTx.category,
                                description: scheduledTx.description,
                                checked: false
                            };
                            newTransactions.push(newTx);
                            await dbService.addTransaction(newTx);
                        }

                        // Advance date based on frequency
                        const currentDate = new Date(scheduledTx.nextDate);
                        let newDate: Date;

                        // Helper to add months safely
                        const addMonths = (date: Date, months: number) => {
                            const d = new Date(date);
                            d.setMonth(d.getMonth() + months);
                            return d;
                        };

                        switch (scheduledTx.frequency) {
                            case 'once':
                                // For 'once', we don't advance, we should probably delete or mark as done
                                // For now, let's push it far into the future to stop processing
                                newDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 100));
                                break;
                            case 'daily':
                                newDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
                                break;
                            case 'weekly':
                                newDate = new Date(currentDate.setDate(currentDate.getDate() + 7));
                                break;
                            case 'biweekly': // Every 2 weeks
                                newDate = new Date(currentDate.setDate(currentDate.getDate() + 14));
                                break;
                            case 'bimonthly': // Twice a month (approx every 15 days)
                                newDate = new Date(currentDate.setDate(currentDate.getDate() + 15));
                                break;
                            case 'fourweekly': // Every 4 weeks
                                newDate = new Date(currentDate.setDate(currentDate.getDate() + 28));
                                break;
                            case 'monthly':
                                newDate = addMonths(currentDate, 1);
                                break;
                            case 'bimestrial': // Every 2 months
                                newDate = addMonths(currentDate, 2);
                                break;
                            case 'quarterly': // Every 3 months
                                newDate = addMonths(currentDate, 3);
                                break;
                            case 'fourmonthly': // Every 4 months
                                newDate = addMonths(currentDate, 4);
                                break;
                            case 'semiannual': // Every 6 months
                                newDate = addMonths(currentDate, 6);
                                break;
                            case 'annual':
                                newDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 1));
                                break;
                            case 'biennial': // Every 2 years
                                newDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 2));
                                break;
                            default:
                                newDate = addMonths(currentDate, 1); // Default to monthly
                        }

                        scheduledTx.nextDate = newDate.toISOString().split('T')[0];
                        nextDate = new Date(scheduledTx.nextDate);
                        nextDate.setHours(0, 0, 0, 0);

                        // If it was 'once', we might want to remove it from scheduled list
                        if (scheduledTx.frequency === 'once') {
                            // Logic to remove could be here, but for safety we just pushed date
                        }
                    }

                    if (modified) {
                        if (scheduledTx.frequency === 'once') {
                            await dbService.deleteScheduled(scheduledTx.id);
                            processedScheduled.splice(i, 1);
                            i--; // Adjust index since we removed an item
                        } else {
                            await dbService.updateScheduled(scheduledTx);
                        }
                    }
                }

                setAccounts(currentAccounts);
                setTransactions([...newTransactions, ...currentTransactions]);
                setCategories(currentCategories);
                setScheduled(processedScheduled);

            } catch (error) {
                console.error("Failed to initialize database:", error);
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    // --- Accounts ---
    const addAccount = async (account: Omit<Account, 'id'>) => {
        const newAccount: Account = {
            ...account,
            id: uuidv4(),
            icon: account.icon || getAccountDefaults(account.type).icon,
            color: account.color || getAccountDefaults(account.type).color
        };
        await dbService.addAccount(newAccount);
        setAccounts(prev => [...prev, newAccount]);
        return newAccount.id;
    };

    const updateAccount = async (account: Account) => {
        await dbService.updateAccount(account);
        setAccounts(prev => prev.map(a => a.id === account.id ? account : a));
    };

    const deleteAccount = async (id: string) => {
        await dbService.deleteAccount(id);
        // Also delete associated transactions and scheduled transactions
        const transactionsToDelete = transactions.filter(t => t.accountId === id).map(t => t.id);
        const scheduledToDelete = scheduled.filter(s => s.accountId === id).map(s => s.id);

        await Promise.all([
            ...transactionsToDelete.map(txId => dbService.deleteTransaction(txId)),
            ...scheduledToDelete.map(schId => dbService.deleteScheduled(schId))
        ]);

        setAccounts(prev => prev.filter(a => a.id !== id));
        setTransactions(prev => prev.filter(t => t.accountId !== id));
        setScheduled(prev => prev.filter(s => s.accountId !== id));
        if (filterAccount.includes(id)) setFilterAccount(filterAccount.filter(a => a !== id));
    };

    // --- Transactions ---
    const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
        const newTransaction: Transaction = { ...transaction, id: uuidv4() };
        await dbService.addTransaction(newTransaction);
        setTransactions(prev => [newTransaction, ...prev]);
        return newTransaction.id;
    };

    const addTransfer = async (fromAccountId: string, toAccountId: string, amount: number, date: string, description: string) => {
        const fromTxId = uuidv4();
        const toTxId = uuidv4();

        const fromTx: Transaction = {
            id: fromTxId,
            date,
            accountId: fromAccountId,
            type: 'expense',
            amount,
            category: 'transfer',
            description,
            checked: false,
            isTransfer: true,
            linkedTransactionId: toTxId
        };

        const toTx: Transaction = {
            id: toTxId,
            date,
            accountId: toAccountId,
            type: 'income',
            amount,
            category: 'transfer',
            description,
            checked: false,
            isTransfer: true,
            linkedTransactionId: fromTxId
        };

        await Promise.all([
            dbService.addTransaction(fromTx),
            dbService.addTransaction(toTx)
        ]);

        setTransactions(prev => [fromTx, toTx, ...prev]);
    };

    const updateTransaction = async (transaction: Transaction) => {
        await dbService.updateTransaction(transaction);
        setTransactions(prev => prev.map(t => t.id === transaction.id ? transaction : t));
    };

    const deleteTransaction = async (id: string) => {
        await dbService.deleteTransaction(id);
        setTransactions(prev => prev.filter(t => t.id !== id));
    };

    const toggleTransactionCheck = async (id: string) => {
        const transaction = transactions.find(t => t.id === id);
        if (transaction) {
            const updated = { ...transaction, checked: !transaction.checked };
            await updateTransaction(updated);
        }
    };

    // --- Categories ---
    const addCategory = async (category: Omit<Category, 'id'>) => {
        const newCategory: Category = { ...category, id: uuidv4() };
        await dbService.addCategory(newCategory);
        setCategories(prev => [...prev, newCategory]);
        return newCategory.id;
    };

    const updateCategory = async (category: Category) => {
        await dbService.updateCategory(category);
        setCategories(prev => prev.map(c => c.id === category.id ? category : c));
    };

    const deleteCategory = async (id: string) => {
        await dbService.deleteCategory(id);
        setCategories(prev => prev.filter(c => c.id !== id));
    };

    // --- Scheduled ---
    const addScheduled = async (scheduledTx: Omit<ScheduledTransaction, 'id'>) => {
        const newScheduled: ScheduledTransaction = { ...scheduledTx, id: uuidv4() };
        await dbService.addScheduled(newScheduled);
        setScheduled(prev => [...prev, newScheduled]);
    };

    const updateScheduled = async (scheduledTx: ScheduledTransaction) => {
        await dbService.updateScheduled(scheduledTx);
        setScheduled(prev => prev.map(s => s.id === scheduledTx.id ? scheduledTx : s));
    };

    const deleteScheduled = async (id: string) => {
        await dbService.deleteScheduled(id);
        setScheduled(prev => prev.filter(s => s.id !== id));
    };

    const getAccountDefaults = (type: string) => {
        switch (type) {
            case 'Épargne': return { icon: 'PiggyBank', color: '#10b981' };
            case 'Espèces': return { icon: 'Banknote', color: '#f59e0b' };
            case 'Investissement': return { icon: 'TrendingUp', color: '#8b5cf6' };
            default: return { icon: 'Wallet', color: '#3b82f6' };
        }
    };

    return (
        <BankContext.Provider value={{
            accounts,
            transactions,
            categories,
            scheduled,
            addAccount,
            updateAccount,
            deleteAccount,
            addTransaction,
            addTransfer,
            updateTransaction,
            deleteTransaction,
            toggleTransactionCheck,
            addCategory,
            updateCategory,
            deleteCategory,
            addScheduled,
            updateScheduled,
            deleteScheduled,
            filterAccount,
            setFilterAccount,
            isLoading
        }}>
            {children}
        </BankContext.Provider>
    );
};

export const useBank = () => {
    const context = useContext(BankContext);
    if (context === undefined) {
        throw new Error('useBank must be used within a BankProvider');
    }
    return context;
};
