import { format } from 'date-fns';
import * as locales from 'date-fns/locale';

// Default to French, but can be easily changed or linked to settings
const DEFAULT_LOCALE = 'fr';
const getLocale = () => {
    // In the future, this can pull from user settings
    return (locales as any)[DEFAULT_LOCALE] || locales.fr;
};

export const formatCurrency = (amount: number, minimumFractionDigits: number = 2): string => {
    return new Intl.NumberFormat(navigator.language || 'fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits,
        maximumFractionDigits: 2
    }).format(amount);
};

export const formatDate = (date: string | Date, formatStr: string = 'dd/MM/yyyy'): string => {
    try {
        return format(new Date(date), formatStr, { locale: getLocale() });
    } catch (e) {
        return String(date);
    }
};
