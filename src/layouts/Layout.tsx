import React, { useState } from 'react';
import { Wallet, LayoutDashboard, PieChart, TrendingUp, Settings, Receipt, CalendarClock, Tag, Calculator, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { useBank } from '../context/BankContext';
import { useUpdater } from '../hooks/useUpdater';
import MultiSelect from '../components/ui/MultiSelect';
import TitleBar from '../components/ui/TitleBar';
import { useFinancialMetrics } from '../hooks/useFinancialMetrics';
import { formatCurrency } from '../utils/format';

interface LayoutProps {
    children: React.ReactNode;
    activePage: string;
    setActivePage: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activePage, setActivePage }) => {
    const { accounts, filterAccount, setFilterAccount } = useBank();
    const { currentBalance, checkedBalance } = useFinancialMetrics();
    const { updateAvailable } = useUpdater();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [appVersion, setAppVersion] = useState('0.1.4');

    React.useEffect(() => {
        import('@tauri-apps/api/app').then(app => {
            app.getVersion().then(setAppVersion).catch(() => {});
        });
    }, []);

    const navGroups = [
        {
            title: "Général",
            items: [
                { id: 'dashboard', label: 'Vue d\'ensemble', icon: LayoutDashboard },
                { id: 'accounts', label: 'Mes Comptes', icon: Wallet },
                { id: 'transactions', label: 'Journal', icon: Receipt },
            ]
        },
        {
            title: "Finances",
            items: [
                { id: 'budget', label: 'Budget', icon: Calculator },
                { id: 'scheduled', label: 'Échéancier', icon: CalendarClock },
            ]
        },
        {
            title: "Analyses",
            items: [
                { id: 'analytics', label: 'Analyses', icon: PieChart },
                { id: 'predictions', label: 'Prédictions', icon: TrendingUp },
            ]
        }
    ];

    return (
        <div className="flex h-screen w-screen text-gray-900 dark:text-gray-100 font-sans overflow-hidden bg-white dark:bg-black">
            <TitleBar />
            
            {/* Sidebar */}
            <aside className={`flex-shrink-0 flex flex-col bg-[#F5F5F7] dark:bg-black border-r border-black/[0.05] dark:border-white/10 z-20 transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-56'}`}>
                <div className="h-12 w-full flex-shrink-0 flex items-center justify-end px-4" data-tauri-drag-region>
                    <button 
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-900 text-gray-400 transition-colors mt-2"
                    >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hide">
                    {navGroups.map((group, idx) => (
                        <div key={idx} className={idx > 0 ? "mt-6" : ""}>
                            {!isCollapsed && (
                                <h3 className="px-4 text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-2 animate-in fade-in duration-300">
                                    {group.title}
                                </h3>
                            )}
                            <div className="space-y-0.5">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = activePage === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setActivePage(item.id)}
                                            title={isCollapsed ? item.label : ""}
                                            className={`w-full flex items-center gap-3 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
                                                isActive
                                                    ? 'bg-primary-500 text-white shadow-sm'
                                                    : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-900'
                                            } ${isCollapsed ? 'justify-center px-0' : ''}`}
                                        >
                                            <Icon className="w-4 h-4 shrink-0" />
                                            {!isCollapsed && <span className="truncate">{item.label}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-black/[0.05] dark:border-white/10">
                    <div className="space-y-0.5">
                        <button
                            onClick={() => setActivePage('categories')}
                            title={isCollapsed ? "Catégories" : ""}
                            className={`w-full flex items-center gap-3 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
                                activePage === 'categories' ? 'bg-primary-500 text-white' : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-900'
                            } ${isCollapsed ? 'justify-center px-0' : ''}`}
                        >
                            <Tag className="w-4 h-4 shrink-0" />
                            {!isCollapsed && <span>Catégories</span>}
                        </button>
                        <button
                            onClick={() => setActivePage('settings')}
                            title={isCollapsed ? "Paramètres" : ""}
                            className={`w-full flex items-center gap-3 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer relative ${
                                activePage === 'settings' ? 'bg-primary-500 text-white' : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-900'
                            } ${isCollapsed ? 'justify-center px-0' : ''}`}
                        >
                            <div className="relative">
                                <Settings className="w-4 h-4 shrink-0" />
                                {updateAvailable && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-black animate-pulse" />
                                )}
                            </div>
                            {!isCollapsed && (
                                <div className="flex-1 flex justify-between items-center">
                                    <span>Paramètres</span>
                                    {updateAvailable && (
                                        <span className="w-2 h-2 bg-red-500 rounded-full" title="Mise à jour disponible" />
                                    )}
                                </div>
                            )}
                        </button>
                    </div>
                    {!isCollapsed && (
                        <div className="mt-4 text-[9px] text-gray-400 text-center font-bold uppercase tracking-widest opacity-60 animate-in fade-in duration-500">
                            DmxMoney 2025 • v{appVersion}
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#F9FAFB] dark:bg-black overflow-hidden">
                <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 bg-[#F9FAFB] dark:bg-black z-30 border-b border-black/[0.05] dark:border-white/10" data-tauri-drag-region>
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-medium text-gray-500 hidden sm:inline">Compte :</span>
                        <MultiSelect
                            value={filterAccount}
                            onChange={setFilterAccount}
                            options={accounts.map(acc => ({ id: acc.id, label: acc.name, icon: acc.icon, color: acc.color }))}
                            placeholder="Tous les comptes"
                            className="w-48 sm:w-64"
                        />
                    </div>

                    <div className="flex items-center gap-4 sm:gap-10">
                        <div className="text-right">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Pointé</div>
                            <div className="text-sm sm:text-lg font-bold text-emerald-600">
                                {formatCurrency(checkedBalance)}
                            </div>
                        </div>
                        <div className="h-8 w-px bg-gray-200 dark:bg-neutral-700 opacity-50 hidden xs:block"></div>
                        <div className="text-right">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Actuel</div>
                            <div className="text-base sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                                {formatCurrency(currentBalance)}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-8 py-4">
                    <div className="max-w-7xl mx-auto w-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;