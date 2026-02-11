import React, { useMemo } from 'react';
import { useBank } from '../context/BankContext';
import { format, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="app-card p-3 shadow-lg">
                {payload[0]?.payload?.fullDate && <p className="font-medium text-gray-900 dark:text-gray-200 mb-2">{payload[0].payload.fullDate}</p>}
                {[...payload].sort((a: any, b: any) => b.value - a.value).map((entry: any, index: number) => (
                    <p key={index} className="text-sm" style={{ color: entry.color || entry.stroke }}>
                        {entry.name}: {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(entry.value)}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const Predictions: React.FC = () => {
    const { accounts: allAccounts, scheduled: allScheduled, transactions: allTransactions, filterAccount } = useBank();

    const accounts = useMemo(() => filterAccount.length === 0 ? allAccounts : allAccounts.filter(a => filterAccount.includes(a.id)), [allAccounts, filterAccount]);
    const transactions = useMemo(() => filterAccount.length === 0 ? allTransactions : allTransactions.filter(t => filterAccount.includes(t.accountId)), [allTransactions, filterAccount]);
    const scheduled = useMemo(() => filterAccount.length === 0 ? allScheduled : allScheduled.filter(s =>
        filterAccount.includes(s.accountId) || (s.type === 'transfer' && s.toAccountId && filterAccount.includes(s.toAccountId))
    ), [allScheduled, filterAccount]);

    // Calculate current total balance
    const currentTotalBalance = useMemo(() => {
        const initialBalanceSum = accounts.reduce((sum, acc) => sum + acc.initialBalance, 0);
        const transactionsSum = transactions.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
        return initialBalanceSum + transactionsSum;
    }, [accounts, transactions]);

    const predictionData = useMemo(() => {
        const data = [];
        // Use integers (cents) for calculations to avoid floating point errors
        const currentBalances: Record<string, number> = {};
        const dailyImpacts: Record<string, Record<string, number>> = {}; // accountId -> date (YYYY-MM-DD) -> amount in cents

        // Initialize current balances and dailyImpacts structure
        accounts.forEach(acc => {
            const accountTransactions = transactions.filter(t => t.accountId === acc.id);
            const balanceCents = Math.round(acc.initialBalance * 100) + accountTransactions.reduce((sum, t) => sum + Math.round((t.type === 'income' ? t.amount : -t.amount) * 100), 0);
            currentBalances[acc.id] = balanceCents;
            dailyImpacts[acc.id] = {};
        });

        // Use local dates strictly to avoid UTC issues
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const daysToProject = 365;
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + daysToProject);

        // Pre-calculate impacts for all scheduled transactions
        scheduled.forEach(item => {
            // Parse date manually to ensure local time at 00:00:00
            const [y, m, d] = item.nextDate.split('-').map(Number);
            let nextDate = new Date(y, m - 1, d);
            nextDate.setHours(0, 0, 0, 0);

            const amountCents = Math.round(item.amount * 100);

            // Parse end date if exists
            let itemEndDate: Date | null = null;
            if (item.endDate) {
                const [ey, em, ed] = item.endDate.split('-').map(Number);
                itemEndDate = new Date(ey, em - 1, ed);
                itemEndDate.setHours(0, 0, 0, 0);
            }

            while (nextDate <= endDate) {
                // Stop if we passed the end date
                if (itemEndDate && nextDate > itemEndDate) break;

                // Only process if date is in the future (or today)
                if (nextDate >= today) {
                    const dateStr = format(nextDate, 'yyyy-MM-dd');

                    // Handle different transaction types
                    if (item.type === 'transfer' && item.toAccountId) {
                        // Transfer: Debit from source, credit to destination
                        if (dailyImpacts[item.accountId]) {
                            dailyImpacts[item.accountId][dateStr] = (dailyImpacts[item.accountId][dateStr] || 0) - amountCents;
                        }
                        if (dailyImpacts[item.toAccountId]) {
                            dailyImpacts[item.toAccountId][dateStr] = (dailyImpacts[item.toAccountId][dateStr] || 0) + amountCents;
                        }
                    } else {
                        // Standard income or expense
                        if (dailyImpacts[item.accountId]) {
                            const amount = item.type === 'income' ? amountCents : -amountCents;
                            dailyImpacts[item.accountId][dateStr] = (dailyImpacts[item.accountId][dateStr] || 0) + amount;
                        }
                    }
                }

                // Advance date based on frequency
                const currentDate = new Date(nextDate);
                let newDate: Date;

                switch (item.frequency) {
                    case 'once':
                        // Move past end date to stop loop
                        newDate = new Date(endDate);
                        newDate.setDate(newDate.getDate() + 1);
                        break;
                    case 'daily':
                        newDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
                        break;
                    case 'weekly':
                        newDate = new Date(currentDate.setDate(currentDate.getDate() + 7));
                        break;
                    case 'biweekly':
                        newDate = new Date(currentDate.setDate(currentDate.getDate() + 14));
                        break;
                    case 'bimonthly':
                        newDate = new Date(currentDate.setDate(currentDate.getDate() + 15));
                        break;
                    case 'fourweekly':
                        newDate = new Date(currentDate.setDate(currentDate.getDate() + 28));
                        break;
                    case 'monthly':
                        newDate = addMonths(currentDate, 1);
                        break;
                    case 'bimestrial':
                        newDate = addMonths(currentDate, 2);
                        break;
                    case 'quarterly':
                        newDate = addMonths(currentDate, 3);
                        break;
                    case 'fourmonthly':
                        newDate = addMonths(currentDate, 4);
                        break;
                    case 'semiannual':
                        newDate = addMonths(currentDate, 6);
                        break;
                    case 'annual':
                        newDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 1));
                        break;
                    case 'biennial':
                        newDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 2));
                        break;
                    default:
                        newDate = addMonths(currentDate, 1);
                }
                nextDate = newDate;
                nextDate.setHours(0, 0, 0, 0);
            }
        });

        // Generate points for the graph
        for (let i = 0; i <= daysToProject; i++) {
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + i);
            const dateStr = format(targetDate, 'yyyy-MM-dd');

            const dayData: any = {
                date: targetDate.toISOString(),
                displayDate: format(targetDate, 'd MMM', { locale: fr }),
                fullDate: format(targetDate, 'd MMMM yyyy', { locale: fr }),
                total: 0
            };

            // Apply impacts and calculate totals
            accounts.forEach(acc => {
                const impactCents = dailyImpacts[acc.id]?.[dateStr] || 0;
                currentBalances[acc.id] += impactCents;

                // Convert back to float for display
                dayData[acc.id] = currentBalances[acc.id] / 100;
                dayData.total += currentBalances[acc.id];
            });

            // Convert total to float
            dayData.total = dayData.total / 100;

            data.push(dayData);
        }
        return data;
    }, [accounts, transactions, scheduled]);

    // Custom tick formatter to show only months
    const formatXAxis = (tickItem: string) => {
        const date = new Date(tickItem);
        // Show label only if it's the 1st of the month
        if (date.getDate() === 1) {
            return format(date, 'MMM', { locale: fr });
        }
        return '';
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-200">Prédictions Financières</h2>

            <div className="app-card p-6">
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200">Projection sur 1 an (Journalière)</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Visualisation de la trésorerie jour par jour.</p>
                </div>

                <div className="h-96" style={{ minHeight: '384px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={predictionData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                {accounts.map(acc => (
                                    <linearGradient key={acc.id} id={`color-${acc.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={acc.color || '#3b82f6'} stopOpacity={0.8} />
                                        <stop offset="95%" stopColor={acc.color || '#3b82f6'} stopOpacity={0} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tickFormatter={formatXAxis}
                                minTickGap={30}
                            />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            {accounts.map(acc => (
                                <Area
                                    key={acc.id}
                                    type="stepAfter" // Use stepAfter for clearer cash flow jumps
                                    dataKey={acc.id}
                                    name={acc.name}
                                    stroke={acc.color || '#3b82f6'}
                                    fill={`url(#color-${acc.id})`}
                                    fillOpacity={1}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="app-card p-6">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Solde Actuel Total</h3>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-200">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(currentTotalBalance)}
                    </div>
                </div>
                <div className="app-card p-6">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Projection Total +6 Mois</h3>
                    <div className={`text-2xl font-bold ${predictionData[180]?.total >= currentTotalBalance ? 'text-emerald-600' : 'text-red-600'}`}>
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(predictionData[180]?.total || 0)}
                    </div>
                </div>
                <div className="app-card p-6">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Projection Total +1 An</h3>
                    <div className={`text-2xl font-bold ${predictionData[predictionData.length - 1]?.total >= currentTotalBalance ? 'text-emerald-600' : 'text-red-600'}`}>
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(predictionData[predictionData.length - 1]?.total || 0)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Predictions;
