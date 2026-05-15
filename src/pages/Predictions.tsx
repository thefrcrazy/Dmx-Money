import React, { useEffect, useMemo, useState } from 'react';
import { useBank } from '../context/BankContext';
import { format, addMonths, endOfMonth, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import Button from '../components/ui/Button';

type PredictionTimeRange = 'week' | 'month' | '2months' | '3months' | '6months' | '9months' | 'year' | 'custom';

interface AlertCrossingMarker {
    date: string;
    fullDate: string;
    labels: string[];
    crossingNames: string[];
    severity: 'warning' | 'danger';
    balances: Array<{
        name: string;
        color: string;
        value: number;
    }>;
}

const PREDICTION_TIME_RANGE_STORAGE_KEY = 'dmxmoney.predictions.timeRange';
const PREDICTION_CUSTOM_END_DATE_STORAGE_KEY = 'dmxmoney.predictions.customEndDate';
const PREDICTION_ALERT_THRESHOLD_STORAGE_KEY = 'dmxmoney.predictions.alertThreshold';
const PREDICTION_MONTH_START_STORAGE_KEY = 'dmxmoney.predictions.monthStartsOnFirst';

const PREDICTION_TIME_RANGES: PredictionTimeRange[] = ['week', 'month', '2months', '3months', '6months', '9months', 'year', 'custom'];

const PREDICTION_TIME_RANGE_LABELS: Record<PredictionTimeRange, string> = {
    week: 'Semaine',
    month: 'Mois',
    '2months': '2 Mois',
    '3months': '3 Mois',
    '6months': '6 Mois',
    '9months': '9 Mois',
    year: '1 An',
    custom: 'Personnalisé'
};

const PREDICTION_TITLE_LABELS: Record<PredictionTimeRange, string> = {
    week: '1 semaine',
    month: '1 mois',
    '2months': '2 mois',
    '3months': '3 mois',
    '6months': '6 mois',
    '9months': '9 mois',
    year: '1 an',
    custom: 'personnalisée'
};

const getStoredPredictionTimeRange = (): PredictionTimeRange => {
    try {
        const stored = localStorage.getItem(PREDICTION_TIME_RANGE_STORAGE_KEY) as PredictionTimeRange | null;
        return stored && PREDICTION_TIME_RANGES.includes(stored) ? stored : 'year';
    } catch {
        return 'year';
    }
};

const getDefaultCustomEndDate = () => format(addMonths(new Date(), 1), 'yyyy-MM-dd');

const getStoredCustomEndDate = () => {
    try {
        return localStorage.getItem(PREDICTION_CUSTOM_END_DATE_STORAGE_KEY) || getDefaultCustomEndDate();
    } catch {
        return getDefaultCustomEndDate();
    }
};

const getStoredAlertThreshold = () => {
    try {
        const stored = Number(localStorage.getItem(PREDICTION_ALERT_THRESHOLD_STORAGE_KEY));
        return Number.isFinite(stored) ? stored : 0;
    } catch {
        return 0;
    }
};

const getStoredMonthStartsOnFirst = () => {
    try {
        const stored = localStorage.getItem(PREDICTION_MONTH_START_STORAGE_KEY);
        return stored === null ? true : stored === 'true';
    } catch {
        return true;
    }
};

const parseLocalDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    date.setHours(0, 0, 0, 0);
    return date;
};

const getProjectionEndDate = (timeRange: PredictionTimeRange, customEndDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (timeRange === 'custom') {
        const [year, month, day] = customEndDate.split('-').map(Number);
        const endDate = new Date(year, (month || 1) - 1, day || 1);
        endDate.setHours(0, 0, 0, 0);
        return endDate < today ? today : endDate;
    }

    if (timeRange === 'week') {
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 7);
        return endDate;
    }

    const monthsByRange: Record<Exclude<PredictionTimeRange, 'week' | 'custom'>, number> = {
        month: 1,
        '2months': 2,
        '3months': 3,
        '6months': 6,
        '9months': 9,
        year: 12
    };

    return addMonths(today, monthsByRange[timeRange]);
};

const CustomTooltip = ({ active, payload, negativeMarkerByDate, alertThreshold }: any) => {
    if (active && payload && payload.length) {
        const date = payload[0]?.payload?.date;
        const negativeMarker: AlertCrossingMarker | undefined = date ? negativeMarkerByDate?.get(date) : undefined;
        const highlightedNames = new Set(negativeMarker?.crossingNames || []);

        return (
            <div className="app-card p-3 shadow-lg">
                {payload[0]?.payload?.fullDate && <p className="font-medium text-gray-900 dark:text-gray-200 mb-2">{payload[0].payload.fullDate}</p>}
                <div className="space-y-1">
                    {[...payload].sort((a: any, b: any) => b.value - a.value).map((entry: any, index: number) => {
                        const entryValue = Number(entry.value);
                        const isDangerValue = entryValue < 0;
                        const isWarningValue = !isDangerValue && entryValue < alertThreshold;
                        const isNegativeCrossing = highlightedNames.has(entry.name);
                        const shouldHighlightDanger = isDangerValue || (isNegativeCrossing && negativeMarker?.severity === 'danger');
                        const shouldHighlightWarning = !shouldHighlightDanger && (isWarningValue || isNegativeCrossing);

                        return (
                            <div
                                key={index}
                                className={`rounded-md px-2 py-1 text-sm font-medium ${
                                    shouldHighlightDanger
                                        ? 'bg-red-500/15 ring-1 ring-red-500/25'
                                        : shouldHighlightWarning
                                            ? 'bg-orange-500/15 ring-1 ring-orange-500/25'
                                            : ''
                                }`}
                                style={{
                                    color: shouldHighlightDanger
                                        ? '#ef4444'
                                        : shouldHighlightWarning
                                            ? '#f97316'
                                            : entry.color || entry.stroke
                                }}
                            >
                                {entry.name}: {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(entry.value)}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return null;
};

const Predictions: React.FC = () => {
    const { accounts: allAccounts, scheduled: allScheduled, transactions: allTransactions, filterAccount } = useBank();
    const [timeRange, setTimeRange] = useState<PredictionTimeRange>(getStoredPredictionTimeRange);
    const [customEndDate, setCustomEndDate] = useState(getStoredCustomEndDate);
    const [alertThreshold, setAlertThreshold] = useState(getStoredAlertThreshold);
    const [monthStartsOnFirst, setMonthStartsOnFirst] = useState(getStoredMonthStartsOnFirst);

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

    useEffect(() => {
        localStorage.setItem(PREDICTION_TIME_RANGE_STORAGE_KEY, timeRange);
    }, [timeRange]);

    useEffect(() => {
        localStorage.setItem(PREDICTION_CUSTOM_END_DATE_STORAGE_KEY, customEndDate);
    }, [customEndDate]);

    useEffect(() => {
        localStorage.setItem(PREDICTION_ALERT_THRESHOLD_STORAGE_KEY, String(alertThreshold));
    }, [alertThreshold]);

    useEffect(() => {
        localStorage.setItem(PREDICTION_MONTH_START_STORAGE_KEY, String(monthStartsOnFirst));
    }, [monthStartsOnFirst]);

    const todayInputValue = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

    const projectionRange = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = timeRange !== 'custom' && monthStartsOnFirst ? startOfMonth(today) : new Date(today);
        startDate.setHours(0, 0, 0, 0);

        const endDate = timeRange === 'month' && monthStartsOnFirst ? endOfMonth(today) : getProjectionEndDate(timeRange, customEndDate);
        endDate.setHours(0, 0, 0, 0);

        const millisecondsPerDay = 1000 * 60 * 60 * 24;
        const daysToProject = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay));

        return { today, startDate, endDate, daysToProject };
    }, [timeRange, customEndDate, monthStartsOnFirst]);

    const predictionData = useMemo(() => {
        const data = [];
        // Use integers (cents) for calculations to avoid floating point errors
        const currentBalances: Record<string, number> = {};
        const dailyImpacts: Record<string, Record<string, number>> = {}; // accountId -> date (YYYY-MM-DD) -> amount in cents

        const { today, startDate, endDate, daysToProject } = projectionRange;

        // Initialize balances at the beginning of the projection range.
        accounts.forEach(acc => {
            const accountTransactions = transactions.filter(t => (
                t.accountId === acc.id && parseLocalDate(t.date) < startDate
            ));
            const balanceCents = Math.round(acc.initialBalance * 100) + accountTransactions.reduce((sum, t) => sum + Math.round((t.type === 'income' ? t.amount : -t.amount) * 100), 0);
            currentBalances[acc.id] = balanceCents;
            dailyImpacts[acc.id] = {};
        });

        transactions.forEach(transaction => {
            const transactionDate = parseLocalDate(transaction.date);
            if (transactionDate < startDate || transactionDate > endDate) return;
            if (!dailyImpacts[transaction.accountId]) return;

            const dateStr = format(transactionDate, 'yyyy-MM-dd');
            const amount = Math.round((transaction.type === 'income' ? transaction.amount : -transaction.amount) * 100);
            dailyImpacts[transaction.accountId][dateStr] = (dailyImpacts[transaction.accountId][dateStr] || 0) + amount;
        });

        // Pre-calculate impacts for all scheduled transactions
        scheduled.forEach(item => {
            // Parse date manually to ensure local time at 00:00:00
            let nextDate = parseLocalDate(item.nextDate);

            const amountCents = Math.round(item.amount * 100);

            // Parse end date if exists
            let itemEndDate: Date | null = null;
            if (item.endDate) {
                itemEndDate = parseLocalDate(item.endDate);
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
            const targetDate = new Date(startDate);
            targetDate.setDate(startDate.getDate() + i);
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
    }, [accounts, transactions, scheduled, projectionRange]);

    const midpointPrediction = predictionData[Math.floor((predictionData.length - 1) / 2)]?.total ?? currentTotalBalance;
    const finalPrediction = predictionData[predictionData.length - 1]?.total ?? currentTotalBalance;
    const negativeCrossingMarkers = useMemo(() => {
        const watchedKeys = ['total', ...accounts.map(account => account.id)];
        const markers = new Map<string, AlertCrossingMarker>();

        predictionData.forEach((point, index) => {
            const crossings = watchedKeys.reduce<Array<{ name: string; severity: 'warning' | 'danger' }>>((acc, key) => {
                const value = Number(point[key] ?? 0);
                const previousValue = index === 0
                    ? 0
                    : Number(predictionData[index - 1]?.[key] ?? 0);
                const account = accounts.find(item => item.id === key);
                const name = account?.name || 'Total';

                if (value < 0 && previousValue >= 0) {
                    acc.push({ name, severity: 'danger' });
                    return acc;
                }

                if (alertThreshold > 0 && value < alertThreshold && previousValue >= alertThreshold) {
                    acc.push({ name, severity: 'warning' });
                }

                return acc;
            }, []);

            if (crossings.length > 0) {
                const severity = crossings.some(crossing => crossing.severity === 'danger') ? 'danger' : 'warning';
                const crossingLabels = crossings.map(crossing => crossing.name);

                markers.set(point.date, {
                    date: point.date,
                    fullDate: point.fullDate,
                    labels: crossingLabels,
                    crossingNames: crossingLabels,
                    severity,
                    balances: accounts.length > 0
                        ? accounts.map(account => ({
                            name: account.name,
                            color: account.color || '#3b82f6',
                            value: Number(point[account.id] ?? 0)
                        }))
                        : [{ name: 'Total', color: '#ef4444', value: Number(point.total ?? 0) }]
                });
            }
        });

        return Array.from(markers.values());
    }, [accounts, alertThreshold, predictionData]);
    const negativeMarkerByDate = useMemo(() => new Map(negativeCrossingMarkers.map(marker => [marker.date, marker])), [negativeCrossingMarkers]);

    // Keep the projection axis readable while still showing day labels.
    const formatXAxis = (tickItem: string) => {
        return format(new Date(tickItem), 'dd MMM', { locale: fr });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-200">Prédictions Financières</h2>

                <div className="flex flex-wrap gap-2 period-selector justify-end">
                    {PREDICTION_TIME_RANGES.map((range) => (
                        <Button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            variant="ghost"
                            size="sm"
                            className={`transition-colors ${timeRange === range
                                ? 'bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/30'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            {PREDICTION_TIME_RANGE_LABELS[range]}
                        </Button>
                    ))}
                </div>
            </div>

            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${timeRange === 'custom' ? 'max-h-48 opacity-100 pointer-events-auto' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                <div className="flex gap-4 app-card p-4 w-fit ml-auto shadow-none">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Jusqu'au</label>
                        <input
                            type="date"
                            value={customEndDate}
                            min={todayInputValue}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="bg-transparent border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="app-card p-6">
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200">
                            Projection sur {PREDICTION_TITLE_LABELS[timeRange]} (Journalière)
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Visualisation de la trésorerie jour par jour.</p>
                    </div>
                    {timeRange !== 'custom' && (
                        <label className="flex w-fit items-center gap-3 rounded-lg border border-gray-200 dark:border-neutral-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                            <input
                                type="checkbox"
                                checked={monthStartsOnFirst}
                                onChange={(event) => setMonthStartsOnFirst(event.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-neutral-600"
                            />
                            Démarrer au 1er du mois
                        </label>
                    )}
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
                            <Tooltip content={<CustomTooltip negativeMarkerByDate={negativeMarkerByDate} alertThreshold={alertThreshold} />} />
                            <Legend />
                            {negativeCrossingMarkers.map(marker => (
                                <ReferenceLine
                                    key={marker.date}
                                    x={marker.date}
                                    stroke={marker.severity === 'danger' ? '#ef4444' : '#f97316'}
                                    strokeWidth={2}
                                    strokeDasharray="3 3"
                                    ifOverflow="extendDomain"
                                />
                            ))}
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
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Projection mi-période</h3>
                    <div className={`text-2xl font-bold ${midpointPrediction >= currentTotalBalance ? 'text-emerald-600' : 'text-red-600'}`}>
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(midpointPrediction)}
                    </div>
                </div>
                <div className="app-card p-6">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Projection au {format(projectionRange.endDate, 'dd MMM yyyy', { locale: fr })}
                    </h3>
                    <div className={`text-2xl font-bold ${finalPrediction >= currentTotalBalance ? 'text-emerald-600' : 'text-red-600'}`}>
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(finalPrediction)}
                    </div>
                </div>
            </div>

            <div className="app-card p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200">Seuil d'alerte</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Le seuil personnalisé s'affiche en orange. Le rouge reste réservé aux soldes négatifs.
                        </p>
                    </div>
                    <div className="w-full md:w-56">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Montant</label>
                        <div className="relative">
                            <input
                                type="number"
                                step="1"
                                value={alertThreshold}
                                onChange={(event) => {
                                    const nextValue = Number(event.target.value);
                                    setAlertThreshold(Number.isFinite(nextValue) ? nextValue : 0);
                                }}
                                className="w-full bg-transparent border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 pr-8 text-sm text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">€</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Predictions;
