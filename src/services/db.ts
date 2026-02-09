import { invoke } from '@tauri-apps/api/core';
import { Account, Transaction, Category, ScheduledTransaction, Settings } from '../types';

export class DatabaseService {
    async init(): Promise<void> {
        // Rust init_db call is not needed here as tauri-plugin-sql or manual rust init 
        // handles it on app setup. We just verify connection by fetching accounts.
        try {
            await this.getAccounts();
        } catch (error) {
            throw error;
        }
    }

    // --- CRUD Operations ---

    // Accounts
    async getAccounts(): Promise<Account[]> {
        try {
            const res = await invoke<Account[]>('get_accounts');
            return res;
        } catch (e) {
            throw e;
        }
    }

    async addAccount(account: Account): Promise<void> {
        try {
            await invoke('add_account', { account });
        } catch (e) {
            throw e;
        }
    }

    async updateAccount(account: Account): Promise<void> {
        try {
            await invoke('update_account', { account });
        } catch (e) {
            throw e;
        }
    }

    async deleteAccount(id: string): Promise<void> {
        try {
            await invoke('delete_account', { id });
        } catch (e) {
            throw e;
        }
    }

    // Transactions
    async getTransactions(): Promise<Transaction[]> {
        try {
            const res = await invoke<Transaction[]>('get_transactions');
            return res;
        } catch (e) {
            throw e;
        }
    }

    async addTransaction(transaction: Transaction): Promise<string> {
        try {
            await invoke('add_transaction', { transaction });
            return transaction.id;
        } catch (e) {
            throw e;
        }
    }

    async updateTransaction(transaction: Transaction): Promise<void> {
        try {
            await invoke('update_transaction', { transaction });
        } catch (e) {
            throw e;
        }
    }

    async deleteTransaction(id: string): Promise<void> {
        try {
            await invoke('delete_transaction', { id });
        } catch (e) {
            throw e;
        }
    }

    // Categories
    async getCategories(): Promise<Category[]> {
        try {
            const res = await invoke<Category[]>('get_categories');
            return res;
        } catch (e) {
            throw e;
        }
    }

    async addCategory(category: Category): Promise<void> {
        try {
            await invoke('add_category', { category });
        } catch (e) {
            throw e;
        }
    }

    async updateCategory(category: Category): Promise<void> {
        try {
            await invoke('update_category', { category });
        } catch (e) {
            throw e;
        }
    }

    async deleteCategory(id: string): Promise<void> {
        try {
            await invoke('delete_category', { id });
        } catch (e) {
            throw e;
        }
    }

    // Scheduled
    async getScheduled(): Promise<ScheduledTransaction[]> {
        try {
            const res = await invoke<ScheduledTransaction[]>('get_scheduled');
            return res;
        } catch (e) {
            throw e;
        }
    }

    async addScheduled(scheduled: ScheduledTransaction): Promise<void> {
        try {
            await invoke('add_scheduled', { scheduled });
        } catch (e) {
            throw e;
        }
    }

    async updateScheduled(scheduled: ScheduledTransaction): Promise<void> {
        try {
            await invoke('update_scheduled', { scheduled });
        } catch (e) {
            throw e;
        }
    }

    async deleteScheduled(id: string): Promise<void> {
        try {
            await invoke('delete_scheduled', { id });
        } catch (e) {
            throw e;
        }
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
        try {
            // Convert objects to JSON strings for Rust
            const settingsToSend = {
                ...settings,
                accountGroups: settings.accountGroups ? JSON.stringify(settings.accountGroups) : null,
                customGroups: settings.customGroups ? JSON.stringify(settings.customGroups) : null,
                customGroupsOrder: settings.customGroupsOrder ? JSON.stringify(settings.customGroupsOrder) : null,
                accountsOrder: settings.accountsOrder ? JSON.stringify(settings.accountsOrder) : null
            };

            await invoke('save_settings', { settings: settingsToSend });
        } catch (e) {
            throw e;
        }
    }
    // --- Data Management ---
    async exportData(): Promise<any> {
        try {
            const accounts = await this.getAccounts();
            const transactions = await this.getTransactions();
            const categories = await this.getCategories();
            const scheduled = await this.getScheduled();
            const settings = await this.getSettings();

            return {
                version: 1,
                timestamp: new Date().toISOString(),
                data: {
                    accounts,
                    transactions,
                    categories,
                    scheduled,
                    settings
                }
            };
        } catch (e) {
            throw e;
        }
    }

    async importData(backupData: any): Promise<void> {
        try {
            // Validate backup data structure
            if (!backupData || !backupData.data) {
                throw new Error('Invalid backup data format');
            }

            // Construct the import payload
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

                // Merge grouping settings
                const newSettings: Settings = {
                    ...currentSettings,
                    accountGroups: importedSettings.accountGroups || currentSettings.accountGroups,
                    customGroups: importedSettings.customGroups || currentSettings.customGroups,
                    // Restore order if available
                    // Note: Types might need update if we added these fields to Settings interface
                    // Assuming they are added as optional fields in Settings interface
                    // @ts-ignore
                    customGroupsOrder: importedSettings.customGroupsOrder || currentSettings.customGroupsOrder,
                    // @ts-ignore
                    accountsOrder: importedSettings.accountsOrder || currentSettings.accountsOrder
                };

                await this.saveSettings(newSettings);
            }
        } catch (e) {
            throw e;
        }
    }

    async mergeData(backupData: any): Promise<void> {
        try {
            // Validate backup data structure
            if (!backupData || !backupData.data) {
                throw new Error('Invalid backup data format');
            }

            // Fetch current data
            const currentAccounts = await this.getAccounts();
            const currentTransactions = await this.getTransactions();
            const currentCategories = await this.getCategories();
            const currentScheduled = await this.getScheduled();

            // Helper to merge arrays by ID
            const mergeArrays = (current: any[], incoming: any[]) => {
                const map = new Map(current.map(item => [item.id, item]));
                incoming.forEach(item => {
                    map.set(item.id, item); // Overwrite existing or add new
                });
                return Array.from(map.values());
            };

            const mergedAccounts = mergeArrays(currentAccounts, backupData.data.accounts || []);
            const mergedTransactions = mergeArrays(currentTransactions, backupData.data.transactions || []);
            const mergedCategories = mergeArrays(currentCategories, backupData.data.categories || []);
            const mergedScheduled = mergeArrays(currentScheduled, backupData.data.scheduled || []);

            const importPayload = {
                accounts: mergedAccounts,
                transactions: mergedTransactions,
                categories: mergedCategories,
                scheduled: mergedScheduled
            };

            await invoke('import_data', { data: importPayload });
        } catch (e) {
            throw e;
        }
    }
}

export const dbService = new DatabaseService();
