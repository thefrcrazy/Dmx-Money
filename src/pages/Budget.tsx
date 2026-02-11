import React from 'react';
import { useBank } from '../context/BankContext';
import { useSettings } from '../context/SettingsContext';
import { useNavigation } from '../context/NavigationContext';
import { format, isSameMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingUp, TrendingDown, AlertCircle, CalendarClock, Receipt } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import Button from '../components/ui/Button';

const Budget: React.FC = () => {
    const { transactions, scheduled, categories } = useBank();
    const { settings } = useSettings();
    const { setActivePage } = useNavigation();

    const now = new Date();
    const currentMonthTransactions = transactions.filter(t => isSameMonth(new Date(t.date), now));

    // 1. Budget Prévu (Scheduled transactions marked for forecast)
    const relevantScheduled = scheduled.filter(s => s.includeInForecast);
    const totalBudgeted = relevantScheduled.reduce((sum, s) => sum + s.amount, 0);

    // 2. Dépenses Réelles (Actual expenses this month)
    const totalExpenses = currentMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    // 3. Budget Restant
    const budgetRemaining = totalBudgeted - totalExpenses;

    // Data for Bar Chart
    const barData = [
        { name: 'Budget Prévu', amount: totalBudgeted, fill: '#8b5cf6' },
        { name: 'Dépenses Réelles', amount: totalExpenses, fill: totalExpenses > totalBudgeted ? '#ef4444' : '#10b981' }
    ];

    // Data for Pie Chart (Expenses by Category)
    const expensesByCategory = currentMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + t.amount;
            return acc;
        }, {} as Record<string, number>);

    const pieData = Object.entries(expensesByCategory)
        .map(([id, amount]) => {
            const cat = categories.find(c => c.id === id);
            return {
                name: cat?.name || 'Inconnu',
                value: amount,
                color: cat?.color || '#9ca3af'
            };
        })
        .sort((a, b) => b.value - a.value);

    return (
        <div className="space-y-6" style={{ gap: `${settings.componentSpacing * 4}px` }}>
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-200">Budget</h2>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setActivePage('scheduled')} icon={CalendarClock}>
                        Échéancier
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setActivePage('transactions')} icon={Receipt}>
                        Journal
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ gap: `${settings.componentSpacing * 4}px` }}>
                <div className="app-card p-6" style={{ padding: `${settings.componentPadding * 4}px` }}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <CalendarClock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Budget Prévu</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-200">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalBudgeted)}
                    </div>
                </div>

                <div className="app-card p-6" style={{ padding: `${settings.componentPadding * 4}px` }}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Dépenses Réelles</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-200">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalExpenses)}
                    </div>
                </div>

                <div className="app-card p-6" style={{ padding: `${settings.componentPadding * 4}px` }}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${budgetRemaining >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                            {budgetRemaining >= 0 ? (
                                <TrendingUp className={`w-5 h-5 ${budgetRemaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-red-600" />
                            )}
                        </div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Budget Restant</span>
                    </div>
                    <div className={`text-2xl font-bold ${budgetRemaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(budgetRemaining)}
                    </div>
                </div>
            </div>

            {/* Budget vs Réel par Catégorie */}
            <div className="app-card p-6" style={{ padding: `${settings.componentPadding * 4}px` }}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200 mb-6">Budget vs Réel par Catégorie</h3>
                <div className="space-y-4">
                    {(() => {
                        // Calculer le budget prévu par catégorie
                        const budgetByCategory: Record<string, number> = {};
                        relevantScheduled.forEach(s => {
                            const catId = s.category || 'other';
                            budgetByCategory[catId] = (budgetByCategory[catId] || 0) + s.amount;
                        });

                        // Obtenir toutes les catégories avec un budget
                        const categoryIds = Object.keys(budgetByCategory);

                        if (categoryIds.length === 0) {
                            return (
                                <div className="text-center text-gray-500 py-8">
                                    Aucune catégorie budgétisée. Ajoutez des échéances avec des catégories pour voir le comparatif.
                                </div>
                            );
                        }

                        // Trouver le max pour le scale
                        const maxBudget = Math.max(...Object.values(budgetByCategory));
                        const maxExpense = Math.max(...Object.values(expensesByCategory), 0);
                        const maxValue = Math.max(maxBudget, maxExpense);

                        return categoryIds.map(catId => {
                            const cat = categories.find(c => c.id === catId);
                            const budgeted = budgetByCategory[catId] || 0;
                            const actual = expensesByCategory[catId] || 0;
                            const budgetPercent = maxValue > 0 ? (budgeted / maxValue) * 100 : 0;
                            const actualPercent = maxValue > 0 ? (actual / maxValue) * 100 : 0;
                            const isOverBudget = actual > budgeted;

                            return (
                                <div key={catId} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: cat?.color || '#9ca3af' }}
                                            />
                                            <span className="font-medium text-gray-900 dark:text-gray-200">
                                                {cat?.name || 'Autre'}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            <span className={isOverBudget ? 'text-red-600 font-medium' : 'text-emerald-600'}>
                                                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(actual)}
                                            </span>
                                            <span className="mx-1">/</span>
                                            <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(budgeted)}</span>
                                        </div>
                                    </div>
                                    <div className="relative h-6 flex flex-col gap-1">
                                        {/* Budget bar */}
                                        <div className="h-2.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-300"
                                                style={{
                                                    width: `${budgetPercent}%`,
                                                    backgroundColor: '#8b5cf6'
                                                }}
                                            />
                                        </div>
                                        {/* Actual bar */}
                                        <div className="h-2.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-300"
                                                style={{
                                                    width: `${actualPercent}%`,
                                                    backgroundColor: isOverBudget ? '#ef4444' : '#10b981'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
                {/* Légende */}
                <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-black/[0.05] dark:border-white/10">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                        <span className="text-sm text-gray-500">Budget Prévu</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-sm text-gray-500">Dépenses Réelles</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-sm text-gray-500">Dépassement</span>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gap: `${settings.componentSpacing * 4}px` }}>
                {/* Bar Chart: Budget vs Actual */}
                <div className="app-card p-6" style={{ padding: `${settings.componentPadding * 4}px` }}>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200 mb-6">Comparatif Budget vs Réel</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--color-bg-primary)',
                                        borderColor: 'var(--color-border)',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                                        padding: '12px 16px'
                                    }}
                                    itemStyle={{ color: 'var(--color-text-primary)' }}
                                    labelStyle={{ color: 'var(--color-text-secondary)', marginBottom: '4px', fontWeight: 500 }}
                                    formatter={(value: any) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(value))}
                                    cursor={{ fill: 'var(--color-primary)', fillOpacity: 0.1 }}
                                />
                                <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={30}>
                                    {barData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pie Chart: Expenses Breakdown */}
                <div className="app-card p-6" style={{ padding: `${settings.componentPadding * 4}px` }}>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200 mb-6">Répartition des Dépenses</h3>
                    <div className="h-[300px] w-full">
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--color-bg-primary)" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--color-bg-primary)',
                                            borderColor: 'var(--color-border)',
                                            borderRadius: '12px',
                                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                                            padding: '12px 16px'
                                        }}
                                        itemStyle={{ color: 'var(--color-text-primary)' }}
                                        labelStyle={{ color: 'var(--color-text-secondary)', marginBottom: '4px', fontWeight: 500 }}
                                        formatter={(value: any) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(value))}
                                    />
                                    <Legend
                                        layout="vertical"
                                        verticalAlign="middle"
                                        align="right"
                                        wrapperStyle={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">Aucune dépense ce mois-ci</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Detailed Budget List (Scheduled Transactions) */}
            <div className="app-card overflow-hidden flex flex-col max-h-[400px]" style={{ padding: `${settings.componentPadding * 4}px` }}>
                <div className="p-6 border-b border-black/[0.05] dark:border-white/10 flex-none">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200">Détail du Budget Prévu</h3>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800 overflow-y-auto scrollbar-thin flex-1">
                    {relevantScheduled.length > 0 ? (
                        relevantScheduled.map(s => (
                            <div key={s.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <div>
                                    <div className="font-medium text-gray-900 dark:text-gray-200">{s.description}</div>
                                    <div className="text-xs text-gray-500">
                                        Prévu le {format(new Date(s.nextDate), 'dd', { locale: fr })} du mois
                                    </div>
                                </div>
                                <div className="font-semibold text-gray-900 dark:text-gray-200">
                                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(s.amount)}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            Aucune dépense prévue dans le budget. Ajoutez des échéances et cochez "Inclure dans le budget prévisionnel".
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Budget;
