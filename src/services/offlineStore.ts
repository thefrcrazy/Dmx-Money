import type { Account, Budget, Category, ScheduledTransaction, Settings, Transaction } from '../types';
import { getMobileApiBaseUrl } from '../utils/runtime';

export type OfflineDataKey =
    | 'accounts'
    | 'transactions'
    | 'categories'
    | 'budgets'
    | 'scheduled'
    | 'settings';

export interface OfflineMutation {
    id: string;
    scope: string;
    path: string;
    method: string;
    body?: string;
    createdAt: number;
    sequence?: number;
}

type OfflineDataMap = {
    accounts: Account[];
    transactions: Transaction[];
    categories: Category[];
    budgets: Budget[];
    scheduled: ScheduledTransaction[];
    settings: Settings | null;
};

interface OfflineDataRecord<K extends OfflineDataKey = OfflineDataKey> {
    key: string;
    scope: string;
    dataKey: K;
    value: OfflineDataMap[K];
    updatedAt: number;
}

const DB_NAME = 'dmxmoney-mobile-offline';
const DB_VERSION = 1;
const DATA_STORE = 'data';
const MUTATION_STORE = 'mutations';

let dbPromise: Promise<IDBDatabase> | null = null;
let mutationSequence = 0;

const currentScope = () => getMobileApiBaseUrl() || 'unpaired';
const scopedKey = (key: OfflineDataKey, scope = currentScope()) => `${scope}:${key}`;

const requestToPromise = <T>(request: IDBRequest<T>) =>
    new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });

const transactionDone = (transaction: IDBTransaction) =>
    new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    });

const openDb = () => {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(DATA_STORE)) {
                db.createObjectStore(DATA_STORE, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(MUTATION_STORE)) {
                db.createObjectStore(MUTATION_STORE, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
    });

    return dbPromise;
};

const randomId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const offlineStore = {
    async getData<K extends OfflineDataKey>(key: K): Promise<OfflineDataMap[K] | null> {
        const db = await openDb();
        const record = await requestToPromise<OfflineDataRecord<K> | undefined>(
            db.transaction(DATA_STORE, 'readonly')
                .objectStore(DATA_STORE)
                .get(scopedKey(key))
        );
        return record?.value ?? null;
    },

    async setData<K extends OfflineDataKey>(key: K, value: OfflineDataMap[K]): Promise<void> {
        const db = await openDb();
        const transaction = db.transaction(DATA_STORE, 'readwrite');
        transaction.objectStore(DATA_STORE).put({
            key: scopedKey(key),
            scope: currentScope(),
            dataKey: key,
            value,
            updatedAt: Date.now(),
        } satisfies OfflineDataRecord<K>);
        await transactionDone(transaction);
    },

    async updateCollection<T extends { id: string }>(
        key: Exclude<OfflineDataKey, 'settings'>,
        updater: (items: T[]) => T[],
    ): Promise<void> {
        const current = ((await this.getData(key)) || []) as unknown as T[];
        await this.setData(key, updater(current) as unknown as OfflineDataMap[typeof key]);
    },

    async enqueueMutation(path: string, method: string, body?: string): Promise<void> {
        const db = await openDb();
        const transaction = db.transaction(MUTATION_STORE, 'readwrite');
        transaction.objectStore(MUTATION_STORE).put({
            id: randomId(),
            scope: currentScope(),
            path,
            method,
            body,
            createdAt: Date.now(),
            sequence: ++mutationSequence,
        } satisfies OfflineMutation);
        await transactionDone(transaction);
    },

    async listMutations(): Promise<OfflineMutation[]> {
        const db = await openDb();
        const mutations = await requestToPromise<OfflineMutation[]>(
            db.transaction(MUTATION_STORE, 'readonly')
                .objectStore(MUTATION_STORE)
                .getAll()
        );
        const scope = currentScope();
        return mutations
            .filter(mutation => mutation.scope === scope)
            .sort((a, b) => (
                a.createdAt - b.createdAt
                || (a.sequence || 0) - (b.sequence || 0)
                || a.id.localeCompare(b.id)
            ));
    },

    async removeMutation(id: string): Promise<void> {
        const db = await openDb();
        const transaction = db.transaction(MUTATION_STORE, 'readwrite');
        transaction.objectStore(MUTATION_STORE).delete(id);
        await transactionDone(transaction);
    },

    async clearAll(): Promise<void> {
        const db = await openDb();
        const transaction = db.transaction([DATA_STORE, MUTATION_STORE], 'readwrite');
        transaction.objectStore(DATA_STORE).clear();
        transaction.objectStore(MUTATION_STORE).clear();
        await transactionDone(transaction);
    },
};
