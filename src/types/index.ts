export type TransactionType = 'income' | 'expense' | 'transfer';
export type Periodicity =
    | 'once'
    | 'daily'
    | 'weekly'
    | 'biweekly'
    | 'bimonthly'
    | 'fourweekly'
    | 'monthly'
    | 'bimestrial'
    | 'quarterly'
    | 'fourmonthly'
    | 'semiannual'
    | 'annual'
    | 'biennial';

export interface Account {
    id: string;
    name: string;
    type: string;
    initialBalance: number;
    color: string;
    icon: string;
}

export interface Transaction {
    id: string;
    date: string;
    accountId: string;
    type: TransactionType;
    amount: number;
    category: string;
    description: string;
    checked: boolean;
    isTransfer?: boolean;
    linkedTransactionId?: string; // For transfers
}

export interface ScheduledTransaction {
    id: string;
    description: string;
    amount: number;
    type: TransactionType;
    frequency: Periodicity;
    accountId: string;
    toAccountId?: string; // For transfers
    nextDate: string;
    category: string;
    includeInForecast?: boolean;
    endDate?: string;
}

export interface Category {
    id: string;
    name: string;
    icon: string;
    color: string;
}

export interface AppData {
    accounts: Account[];
    transactions: Transaction[];
    categories: Category[];
    scheduled: ScheduledTransaction[];
}

export interface BankContextType {
    accounts: Account[];
    transactions: Transaction[];
    categories: Category[];
    scheduled: ScheduledTransaction[];
    addAccount: (account: Omit<Account, 'id'>) => Promise<string>;
    updateAccount: (account: Account) => Promise<void>;
    deleteAccount: (id: string) => Promise<void>;
    addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<string>;
    addTransfer: (fromAccountId: string, toAccountId: string, amount: number, date: string, description: string) => Promise<void>;
    updateTransaction: (transaction: Transaction) => Promise<void>;
    deleteTransaction: (id: string) => Promise<void>;
    toggleTransactionCheck: (id: string) => Promise<void>;
    addCategory: (category: Omit<Category, 'id'>) => Promise<string>;
    updateCategory: (category: Category) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;
    addScheduled: (scheduled: Omit<ScheduledTransaction, 'id'>) => Promise<void>;
    updateScheduled: (scheduled: ScheduledTransaction) => Promise<void>;
    deleteScheduled: (id: string) => Promise<void>;
    filterAccount: string[];
    setFilterAccount: (ids: string[]) => void;
    isLoading: boolean;
}

export type Theme = 'light' | 'dark' | 'system';

export interface Settings {
    theme: Theme;
    primaryColor: string;
    windowPosition: { x: number; y: number } | null;
    windowSize: { width: number; height: number } | null;
    accountGroups?: Record<string, string>; // accountId -> groupName
    customGroups?: string[]; // list of group names
    customGroupsOrder?: string[];
    accountsOrder?: string[];
    componentSpacing: number;
    componentPadding: number;
}

export interface SettingsContextType {
    settings: Settings;
    updateTheme: (theme: Theme) => Promise<void>;
    updatePrimaryColor: (color: string) => Promise<void>;
    updateWindowPosition: (x: number, y: number) => Promise<void>;
    updateWindowSize: (width: number, height: number) => Promise<void>;
    updateAccountGroup: (accountId: string, groupName: string) => Promise<void>;
    updateCustomGroups: (groups: string[]) => Promise<void>;
    renameCustomGroup: (oldName: string, newName: string) => Promise<void>;
    updateCustomGroupsOrder: (order: string[]) => Promise<void>;
    updateAccountsOrder: (order: string[]) => Promise<void>;
    updateComponentSpacing: (spacing: number) => Promise<void>;
    updateComponentPadding: (padding: number) => Promise<void>;
}
