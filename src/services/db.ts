import { invoke } from '@tauri-apps/api/core';
import { Account, Transaction, Category, ScheduledTransaction, Settings } from '../types';

export class DatabaseService {
    async init(): Promise<void> {
        await this.getAccounts();
    }

    // --- CRUD Operations ---

    // Accounts
    async getAccounts(): Promise<Account[]> {
        return invoke<Account[]>('get_accounts');
    }

    async addAccount(account: Account): Promise<void> {
        await invoke('add_account', { account });
    }

    async updateAccount(account: Account): Promise<void> {
        await invoke('update_account', { account });
    }

    async deleteAccount(id: string): Promise<void> {
        await invoke('delete_account', { id });
    }

    // Transactions
    async getTransactions(): Promise<Transaction[]> {
        return invoke<Transaction[]>('get_transactions');
    }

    async addTransaction(transaction: Transaction): Promise<string> {
        await invoke('add_transaction', { transaction });
        return transaction.id;
    }

    async updateTransaction(transaction: Transaction): Promise<void> {
        await invoke('update_transaction', { transaction });
    }

    async deleteTransaction(id: string): Promise<void> {
        await invoke('delete_transaction', { id });
    }

    // Categories
    async getCategories(): Promise<Category[]> {
        return invoke<Category[]>('get_categories');
    }

    async addCategory(category: Category): Promise<void> {
        await invoke('add_category', { category });
    }

    async updateCategory(category: Category): Promise<void> {
        await invoke('update_category', { category });
    }

    async deleteCategory(id: string): Promise<void> {
        await invoke('delete_category', { id });
    }

    // Scheduled
    async getScheduled(): Promise<ScheduledTransaction[]> {
        return invoke<ScheduledTransaction[]>('get_scheduled');
    }

    async addScheduled(scheduled: ScheduledTransaction): Promise<void> {
        await invoke('add_scheduled', { scheduled });
    }

    async updateScheduled(scheduled: ScheduledTransaction): Promise<void> {
        await invoke('update_scheduled', { scheduled });
    }

    async deleteScheduled(id: string): Promise<void> {
        await invoke('delete_scheduled', { id });
    }

    // Settings
    async getSettings(): Promise<Settings | null> {
        try {
            // Define an interface for the raw response from Rust
            interface RawSettings extends Omit<Settings, 'accountGroups' | 'customGroups' | 'customGroupsOrder' | 'accountsOrder'> {
                accountGroups?: string;
                customGroups?: string;
                customGroupsOrder?: string;
                accountsOrder?: string;
            }

            const res = await invoke<RawSettings | null>('get_settings');
            if (!res) return null;

            // Parse JSON strings back to objects
            return {
                ...res,
                accountGroups: res.accountGroups ? JSON.parse(res.accountGroups) : undefined,
                customGroups: res.customGroups ? JSON.parse(res.customGroups) : undefined,
                customGroupsOrder: res.customGroupsOrder ? JSON.parse(res.customGroupsOrder) : undefined,
                accountsOrder: res.accountsOrder ? JSON.parse(res.accountsOrder) : undefined
            };
        } catch (e) {
            return null;
        }
    }

    async saveSettings(settings: Settings): Promise<void> {
        // Convert objects to JSON strings for Rust
        const settingsToSend = {
            ...settings,
            accountGroups: settings.accountGroups ? JSON.stringify(settings.accountGroups) : null,
            customGroups: settings.customGroups ? JSON.stringify(settings.customGroups) : null,
            customGroupsOrder: settings.customGroupsOrder ? JSON.stringify(settings.customGroupsOrder) : null,
            accountsOrder: settings.accountsOrder ? JSON.stringify(settings.accountsOrder) : null
        };

        await invoke('save_settings', { settings: settingsToSend });
    }

    // --- Data Management ---
    async exportData(): Promise<any> {
        const [accounts, transactions, categories, scheduled, settings] = await Promise.all([
            this.getAccounts(),
            this.getTransactions(),
            this.getCategories(),
            this.getScheduled(),
            this.getSettings()
        ]);

        return {
            version: 1,
            timestamp: new Date().toISOString(),
            data: { accounts, transactions, categories, scheduled, settings }
        };
    }

    async importData(backupData: any): Promise<void> {
        if (!backupData || !backupData.data) {
            throw new Error('Invalid backup data format');
        }

        const importPayload = {
            accounts: backupData.data.accounts || [],
            transactions: backupData.data.transactions || [],
            categories: backupData.data.categories || [],
            scheduled: backupData.data.scheduled || []
        };

        await invoke('import_data', { data: importPayload });

        // Restore settings if available (specifically groups)
        if (backupData.data.settings) {
            const currentSettings = await this.getSettings() || {} as Settings;
            const importedSettings = backupData.data.settings;

            const newSettings: Settings = {
                ...currentSettings,
                accountGroups: importedSettings.accountGroups || currentSettings.accountGroups,
                customGroups: importedSettings.customGroups || currentSettings.customGroups,
                // @ts-ignore
                customGroupsOrder: importedSettings.customGroupsOrder || currentSettings.customGroupsOrder,
                // @ts-ignore
                accountsOrder: importedSettings.accountsOrder || currentSettings.accountsOrder
            };

            await this.saveSettings(newSettings);
        }
    }

    async mergeData(backupData: any): Promise<void> {
        if (!backupData || !backupData.data) {
            throw new Error('Invalid backup data format');
        }

        const [currentAccounts, currentTransactions, currentCategories, currentScheduled] = await Promise.all([
            this.getAccounts(),
            this.getTransactions(),
            this.getCategories(),
            this.getScheduled()
        ]);

        const mergeArrays = (current: any[], incoming: any[]) => {
            const map = new Map(current.map(item => [item.id, item]));
            incoming.forEach(item => {
                map.set(item.id, item);
            });
            return Array.from(map.values());
        };

        const importPayload = {
            accounts: mergeArrays(currentAccounts, backupData.data.accounts || []),
            transactions: mergeArrays(currentTransactions, backupData.data.transactions || []),
            categories: mergeArrays(currentCategories, backupData.data.categories || []),
            scheduled: mergeArrays(currentScheduled, backupData.data.scheduled || [])
        };

        await invoke('import_data', { data: importPayload });
    }
}

export const dbService = new DatabaseService();
