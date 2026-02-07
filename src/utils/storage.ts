import { BaseDirectory, readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { AppData } from '../types';

const DB_FILENAME = 'dmxmoney2025_db.json';
const LOCAL_STORAGE_KEY = 'dmxmoney2025_data';

const DEFAULT_DATA: AppData = {
    accounts: [],
    transactions: [],
    categories: [
        { id: '1', name: 'Alimentation', icon: 'ShoppingCart', color: '#ef4444' },
        { id: '2', name: 'Loyer', icon: 'Home', color: '#3b82f6' },
        { id: '3', name: 'Salaire', icon: 'Banknote', color: '#10b981' },
        { id: '4', name: 'Transport', icon: 'Car', color: '#f59e0b' },
        { id: '5', name: 'Loisirs', icon: 'Gamepad2', color: '#8b5cf6' },
        { id: '6', name: 'Santé', icon: 'HeartPulse', color: '#ec4899' },
        { id: '7', name: 'Divers', icon: 'MoreHorizontal', color: '#6b7280' }
    ],
    scheduled: [],
};

const isTauri = () => {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export const loadData = async (): Promise<AppData> => {
    try {
        if (isTauri()) {
            try {
                const fileExists = await exists(DB_FILENAME, { baseDir: BaseDirectory.Document });
                if (!fileExists) {
                    await saveData(DEFAULT_DATA);
                    return DEFAULT_DATA;
                }

                const content = await readTextFile(DB_FILENAME, { baseDir: BaseDirectory.Document });
                return JSON.parse(content);
            } catch (tauriError) {
                // Tauri FS failed, falling back to localStorage
            }
        }

        // Fallback to localStorage
        const localContent = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (localContent) {
            return JSON.parse(localContent);
        }
        return DEFAULT_DATA;
    } catch (error) {
        return DEFAULT_DATA;
    }
};

export const saveData = async (data: AppData): Promise<void> => {
    try {
        // Always save to localStorage as backup/sync
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));

        if (isTauri()) {
            await writeTextFile(DB_FILENAME, JSON.stringify(data, null, 2), { baseDir: BaseDirectory.Document });
        }
    } catch (error) {
        // Don't throw, just log. LocalStorage backup likely succeeded.
    }
};
